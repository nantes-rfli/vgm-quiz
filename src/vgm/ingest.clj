(ns vgm.ingest
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.pprint :as pp]))

(defn read-candidates [dir]
  (let [files (->> (io/file dir)
                   file-seq
                   (filter #(.isFile %))
                   (filter #(str/ends-with? (.getName %) ".edn")))]
    (mapcat (fn [f]
              (let [data (edn/read-string (slurp f))]
                (cond
                  (vector? data) data
                  (map? data) (:items data)
                  :else [])))
            files)))

(defn normalize-track [m]
  (let [nfkc (fn [s]
               (some-> s
                       (java.text.Normalizer/normalize java.text.Normalizer$Form/NFKC)
                       str/trim
                       str/lower-case))
        year-int (fn [y]
                   (some-> y nfkc Integer/parseInt))]
    (-> m
        (update :title nfkc)
        (update :game nfkc)
        (update :composer nfkc)
        (update :year year-int))))

(defn merge-unique [existing new]
  (let [kfn (juxt :title :game :composer :year)
        seen (set (map kfn existing))
        fresh (remove #(contains? seen (kfn %)) new)]
    (vec (concat existing fresh))))

(defn sort-tracks [xs]
  (sort-by (juxt :game :year :title :composer) xs))

(defn rewrite-tracks! [xs]
  (with-open [w (io/writer "resources/data/tracks.edn")]
    (binding [*print-namespace-maps* false]
      (pp/pprint xs w)))
)
