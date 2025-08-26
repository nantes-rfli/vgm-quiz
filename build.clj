(ns build
  (:require [clojure.tools.build.api :as b]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.data.json :as json])
  (:import (java.io PushbackReader)))

(defn clean [_]
  (b/delete {:path "build"}))

(defn- ensure-dir [path]
  (.mkdirs (io/file path)))

(defn- read-edn-file [f]
  (with-open [r (io/reader f)]
    (edn/read (PushbackReader. r))))

(defn dataset [_]
  (ensure-dir "build")                       ;; ← ここで作成
  (let [files  (->> (file-seq (io/file "resources/data"))
                    (filter #(-> % .getName (.endsWith ".edn"))))
        items  (->> files (map read-edn-file) (mapcat identity) vec)
        out    {:dataset_version 1
                :generated_at (str (java.time.Instant/now))
                :tracks items}]
    (spit (io/file "build/dataset.json")
          (json/write-str out))))