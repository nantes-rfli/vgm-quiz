(ns build
  (:require [clojure.tools.build.api :as b]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.data.json :as json])
  (:import (java.io PushbackReader)
           (java.util UUID)))

(defn clean [_]
  (b/delete {:path "build"}))

(defn- ensure-dir [path]
  (.mkdirs (io/file path)))

(defn- read-edn-file [f]
  (with-open [r (io/reader f)]
    (edn/read (PushbackReader. r))))

(defn- ensure-track-id [track]
  (if (:track/id track)
    track
    (let [s (str (:title track) "|" (:game track) "|" (:composer track) "|" (:year track))]
      (assoc track :track/id
             (str (UUID/nameUUIDFromBytes (.getBytes s "UTF-8")))))))

(defn dataset [_]
  (ensure-dir "build")                       ;; ← ここで作成
  (let [files  (->> (file-seq (io/file "resources/data"))
                    (filter #(-> % .getName (.endsWith ".edn"))))
        items  (->> files (map read-edn-file) (mapcat identity) vec)
        tracks (mapv ensure-track-id items)
        out    {:dataset_version 1
                :generated_at (str (java.time.Instant/now))
                :tracks tracks}]
    (spit (io/file "build/dataset.json")
          (json/write-str out :key-fn (fn [k]
                                       (if-let [ns (namespace k)]
                                         (str ns "/" (name k))
                                         (name k))))))

(defn publish [_]
  (dataset nil)
  (ensure-dir "public/build")
  (io/copy (io/file "build/dataset.json")
           (io/file "public/build/dataset.json"))
  (let [af (io/file "resources/data/aliases.edn")]
    (when (.exists af)
      (spit (io/file "public/build/aliases.json")
            (json/write-str (read-edn-file af) :key-fn name)))))
