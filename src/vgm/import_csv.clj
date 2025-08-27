(ns vgm.import-csv
  (:require [clojure.data.csv :as csv]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.pprint :as pp]))

(defn- ->headers [heads]
  (->> heads
       (map #(-> %
                 (str/replace #"^\uFEFF" "")
                 str/trim
                 str/lower-case))
       vec))

(defn parse-csv [path]
  ;; returns seq of {:title :game :composer :year}
  (let [rows (with-open [r (io/reader path)]
               (into [] (csv/read-csv r)))
        headers (->headers (first rows))
        idx (zipmap headers (range))
        required #{"title" "game" "composer" "year"}]
    (when-not (every? idx required)
      (throw (ex-info "CSV missing required columns"
                      {:have (set (keys idx)) :need required})))
    (for [row (rest rows)]
      {:title    (nth row (idx "title") "")
       :game     (nth row (idx "game") "")
       :composer (nth row (idx "composer") "")
       :year     (Integer/parseInt (str (nth row (idx "year") "")))})))

(defn merge-unique
  "existing/new are seqs of track maps. Deduplicate by [title game composer year]."
  [existing new]
  (let [k (fn [{:keys [title game composer year]}]
            [(str/trim title) (str/trim game) (str/trim composer) (int year)])]
    (->> (concat existing new)
         (reduce (fn [m t] (assoc m (k t) t)) {})
         vals
         vec)))

(defn write-edn [out-path items]
  (let [f (io/file out-path)]
    (.getParentFile f)
    (spit f (with-out-str (pp/pprint (vec items))))))
