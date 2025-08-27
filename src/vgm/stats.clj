(ns vgm.stats
  (:gen-class)
  (:require [vgm.core :as core]
            [clojure.string :as str]))

(defn- table [headers rows]
  (println (str "|" (str/join "|" headers) "|"))
  (println (str "|" (str/join "|" (repeat (count headers) "-")) "|"))
  (doseq [r rows]
    (println (str "|" (str/join "|" r) "|"))))

(defn added-by-year []
  (let [tracks (core/load-tracks)
        grouped (->> tracks (group-by :year) (map (fn [[y ts]] [y (count ts)])) (sort-by first))]
    (table ["year" "count"] grouped)))

(defn added-by-composer []
  (let [tracks (core/load-tracks)
        grouped (->> tracks (group-by :composer) (map (fn [[c ts]] [c (count ts)])) (sort-by first))]
    (table ["composer" "count"] grouped)))

(defn -main [& [cmd]]
  (case cmd
    "added-by-year" (added-by-year)
    "added-by-composer" (added-by-composer)
    (println "Unknown command")))
