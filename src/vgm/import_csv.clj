(ns vgm.import-csv
  (:require [clojure.java.io :as io]
            [clojure.string :as str]))

(defn parse-csv [path]
  (with-open [r (io/reader path)]
    (let [lines (line-seq r)
          headers (->> (first lines)
                        (str/split #",")
                        (map str/trim)
                        (map keyword))
          rows (rest lines)]
      (map (fn [line]
             (->> (str/split line #",")
                  (map str/trim)
                  (zipmap headers)))
           rows))))

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

(defn write-edn [out-path items]
  (spit out-path (pr-str items)))
