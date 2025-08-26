(ns vgm.cli
  (:gen-class)
  (:require [vgm.core :as core]))


(defn -main [& [n]]
  (let [n (or (some-> n Integer/parseInt) 5)]
    (core/run-quiz! n)))