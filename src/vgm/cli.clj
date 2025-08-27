(ns vgm.cli
  (:gen-class)
  (:require [vgm.core :as core]
            [vgm.export :as export]
            [vgm.import-csv :as ic]
            [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as str]))

(defn- parse-opts [args]
  (loop [m {} args args]
    (if (seq args)
      (let [[k v & more] args
            k* (keyword (subs k 2))]
        (recur (assoc m k* v) more))
      m)))

(defn -main [& args]
  (let [[cmd & opts] args]
    (case cmd
      "export"
      (let [{:keys [n format]} (parse-opts opts)
            n (or (some-> n Integer/parseInt) 30)
            format (keyword (or format "plain"))
            items (export/build-questions n)
            out (case format
                  :csv (export/to-csv items)
                  (export/to-plain items))]
        (println out))

      "import-csv"
      (let [[in out] opts
            new (map ic/normalize-track (ic/parse-csv in))
            existing (if (.exists (io/file out))
                       (edn/read-string (slurp out))
                       [])
            merged (ic/merge-unique existing new)]
        (ic/write-edn out merged))

      "ingest"
      (let [cand-dir (io/file "resources/candidates")
            files (->> (file-seq cand-dir)
                       (filter #(.isFile %))
                       (filter #(str/ends-with? (.getName %) ".edn")))
            new (->> files
                     (mapcat (fn [f]
                               (map ic/normalize-track
                                    (edn/read-string (slurp f))))))
            out "resources/data/tracks.edn"
            existing (if (.exists (io/file out))
                       (edn/read-string (slurp out))
                       [])
            merged (ic/merge-unique existing new)]
        (ic/write-edn out merged))

      (let [n (or (some-> cmd Integer/parseInt) 5)]
        (core/run-quiz! n)))))