(ns vgm.stats
  (:gen-class)
  (:require [vgm.core :as core]
            [vgm.ingest :as ingest]
            [clojure.string :as str]))

(defn- table
  "Render a markdown table given headers and rows.
  Returns a string with newline separators."
  [headers rows]
  (let [header (str "|" (str/join "|" headers) "|")
        sep    (str "|" (str/join "|" (repeat (count headers) "---")) "|")
        body   (map #(str "|" (str/join "|" %) "|") rows)]
    (str/join "\n" (concat [header sep] body))))

(defn- newly-added
  "Return tracks that are present in candidates but not already in
  `resources/data/tracks.edn`."
  []
  (let [kfn      (juxt :title :game :composer :year)
        existing (set (map kfn (core/load-tracks)))]
    (->> (ingest/read-candidates "resources/candidates")
         (remove #(contains? existing (kfn %)))
         distinct)))

(defn added-by-year []
  (let [grouped (->> (newly-added)
                     (group-by :year)
                     (map (fn [[y ts]] [y (count ts)]))
                     (sort-by first))]
    (println (table ["year" "count"] grouped))))

(defn added-by-composer []
  (let [grouped (->> (newly-added)
                     (group-by :composer)
                     (map (fn [[c ts]] [c (count ts)]))
                     (sort-by second >)
                     (take 10))]
    (println (table ["composer" "count"] grouped))))

(defn -main [& [cmd]]
  (case cmd
    "added-by-year" (added-by-year)
    "added-by-composer" (added-by-composer)
    (println "Unknown command")))

