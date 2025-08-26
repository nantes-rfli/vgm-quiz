(ns build
  (:require [clojure.tools.build.api :as b]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.data.json :as json])
  (:import (java.io PushbackReader)
           (java.util UUID)))

(defn clean [_]
  (b/delete {:path "build"}))

(defn- ensure-dir [path] (.mkdirs (io/file path)))

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
  (let [edn-files (->> (file-seq (io/file "resources/data"))
                       (filter #(-> ^java.io.File % .getName (.endsWith ".edn"))))
        items     (->> edn-files
                       (map read-edn-file)
                       ;; merge only top-level vectors (ignore maps like aliases.edn)
                       (mapcat #(if (vector? %) % []))
                       normalize-items)
        _         (when-not (every? (fn [t] (and (:track/id t)
                                                (not (contains? t :id))))
                                    items)
                    (throw (ex-info "Normalization failed: :track/id missing or legacy :id present" {})))
        out       {:dataset_version 1
                   :generated_at (str (java.time.Instant/now))
                   :tracks items}]
    (spit (io/file "build/dataset.json")
          (json/write-str out))))

(defn- edn->json-file [edn-path json-path]
  (let [in (io/file edn-path)]
    (when (.exists in)
      (let [data (read-edn-file in)]
        (ensure-dir (.getParent (io/file json-path)))
        (spit (io/file json-path) (json/write-str data))))))

(defn publish [_]
  (dataset nil)
  (ensure-dir "public/build")
  (spit (io/file "public/build/dataset.json")
        (slurp (io/file "build/dataset.json")))
  (edn->json-file "resources/data/aliases.edn" "public/build/aliases.json"))
