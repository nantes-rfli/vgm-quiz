(ns edn-schema-test
  (:require [clojure.test :refer [deftest is]]
            [clojure.edn :as edn]
            [clojure.java.io :as io]))

(defn track-entry? [m]
  (and (map? m)
       (string? (:title m))
       (string? (:game m))
       (string? (:composer m))
       (int? (:year m))))

(deftest edn-files-conform-and-are-unique
  (let [files   (->> (io/file "resources/data")
                     (file-seq)
                     (filter #(and (.isFile %) (.endsWith (.getName %) ".edn"))))
        entries (doall (for [f files
                             :let [data (edn/read-string (slurp f))]
                             entry (if (vector? data) data [])]
                         (do (is (track-entry? entry)
                                 (str "invalid schema in " (.getName f) ": " entry))
                             entry)))
        dups    (->> entries
                     (map (juxt :title :game :composer :year))
                     frequencies
                     (filter (fn [[_ c]] (> c 1))))]
    (is (empty? dups)
        (str "duplicate entries: " (map first dups)))))
