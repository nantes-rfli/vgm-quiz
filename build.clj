(ns build
  (:require [clojure.tools.build.api :as b]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.data.json :as json])
  (:import (java.io PushbackReader)
           (java.util UUID)))

(defn clean [_]
  (b/delete {:path "build"}))

(defn- ensure-dir [p] (.mkdirs (io/file p)))

(defn- read-edn-file [^java.io.File f]
  (with-open [r (io/reader f)]
    (edn/read (PushbackReader. r))))

(defn- stable-id [m]
  (or (:track/id m)
      (-> (str (or (:title m) "")
               "|" (or (:game m) "")
               "|" (or (:composer m) "")
               "|" (or (:year m) ""))
          (.getBytes "UTF-8")
          (UUID/nameUUIDFromBytes)
          str)))

(defn- migrate-id [m]
  (cond-> m
    (:id m) (-> (assoc :track/id (:id m))
                (dissoc :id))))

(defn- normalize-track [m0]
  (let [m (-> m0
              migrate-id
              (update :year #(cond
                               (int? %) %
                               (string? %) (Integer/parseInt %)
                               :else %))
              (update :title str)
              (update :game str)
              (update :composer str))]
    (-> m
        (assoc :track/id (stable-id m))
        (dissoc :id))))

(defn- normalize-items [items]
  (->> items (map normalize-track) vec))

(defn dataset [_]
  (ensure-dir "build")
  (let [files (->> (file-seq (io/file "resources/data"))
                   (filter #(-> ^java.io.File % .getName (.endsWith ".edn"))))
        items (->> files
                   (map read-edn-file)
                   ;; 7aのaliases.edn（map）は除外。vectorトップのみ採用。
                   (mapcat #(if (vector? %) % []))
                   normalize-items)
        out   {:dataset_version 1
               :generated_at (str (java.time.Instant/now))
               :tracks items}]
    (spit (io/file "build/dataset.json")
          (json/write-str out))))

(defn- normalize-json-file! [json-path]
  ;; JSON→Clojure（keyword化）→正規化→JSON で上書き
  (let [f (io/file json-path)]
    (when (.exists f)
      (let [data (-> (slurp f)
                     (json/read-str :key-fn keyword))
            tracks (->> (:tracks data) normalize-items)
            out    (assoc data :tracks tracks)]
        (spit f (json/write-str out))))))

(defn- edn->json-file [edn-path json-path]
  (let [in (io/file edn-path)]
    (when (.exists in)
      (let [data (read-edn-file in)]
        (ensure-dir (.getParent (io/file json-path)))
        (spit (io/file json-path) (json/write-str data))))))

(defn publish [_]
  ;; 1) 生成
  (dataset nil)
  ;; 2) 生成物を強制正規化
  (normalize-json-file! "build/dataset.json")
  ;; 3) public 配置
  (ensure-dir "public/build")
  (spit (io/file "public/build/dataset.json")
        (slurp (io/file "build/dataset.json")))
  ;; 4) aliases があれば JSON も出力
  (edn->json-file "resources/data/aliases.edn" "public/build/aliases.json"))
