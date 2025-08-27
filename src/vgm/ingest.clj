(ns vgm.ingest
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.pprint :as pp])
  (:import (java.text Normalizer Normalizer$Form)))

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

(defn- nfkc [s]
  ;; Always safe for any type
  (Normalizer/normalize (str s) Normalizer$Form/NFKC))

(defn- normalize-str [s]
  (some-> s nfkc str/trim)) ; 表示は元の大小を保つ（lower-caseしない）

(defn normalize-track [m0]
  (-> m0
      (update :title normalize-str)
      (update :game normalize-str)
      (update :composer normalize-str)
      (update :year (fn [y]
                      (cond
                        (int? y) y
                        (string? y) (Integer/parseInt (str y))
                        :else y)))))

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
