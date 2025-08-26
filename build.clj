(ns build
  (:require [clojure.tools.build.api :as b]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.data.json :as json])
  (:import (java.io PushbackReader)
           (java.util UUID)))

;; Clean: keep using tools.build for deletion only
(defn clean [_]
  (b/delete {:path "build"}))

(defn- ensure-dir [path]
  (.mkdirs (io/file path)))

(defn- read-edn-file [^java.io.File f]
  (with-open [r (io/reader f)]
    (edn/read (PushbackReader. r))))

(defn- top-level-vector? [x]
  (vector? x))

(defn- stable-id [m]
  (or (:track/id m)
      (-> (str (or (:title m) "")
               "|" (or (:game m) "")
               "|" (or (:composer m) "")
               "|" (or (:year m) ""))
          (.getBytes "UTF-8")
          (UUID/nameUUIDFromBytes)
          str)))

(defn- normalize-track [m]
  (-> m
      (update :year #(if (string? %) (Integer/parseInt %) %))
      (update :title str)
      (update :game str)
      (update :composer str)
      (assoc :track/id (stable-id m))))

(defn dataset [_]
  (ensure-dir "build")
  (let [data-dir  (io/file "resources/data")
        edn-files (->> (file-seq data-dir)
                       (filter #(-> ^java.io.File % .getName (.endsWith ".edn"))))
        items     (->> edn-files
                       (map read-edn-file)
                       ;; 7a で aliases.edn（map）もあるため、vectorトップだけ採用
                       (mapcat #(if (top-level-vector? %) % []))
                       (map normalize-track)
                       vec)
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
  ;; Build dataset first
  (dataset nil)
  ;; Copy dataset.json into public/build/
  (ensure-dir "public/build")
  (spit (io/file "public/build/dataset.json")
        (slurp (io/file "build/dataset.json")))
  ;; If aliases.edn exists, emit public/build/aliases.json
  (edn->json-file "resources/data/aliases.edn" "public/build/aliases.json"))

