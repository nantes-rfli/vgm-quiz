(ns vgm.autofetch
  (:gen-class)
  (:require [vgm.import-csv :as ic]
            [clojure.java.io :as io])
  (:import [java.time LocalDate]
           [java.time.format DateTimeFormatter]))

(defn- today []
  (.format (LocalDate/now) (DateTimeFormatter/ofPattern "yyyyMMdd")))

(defn -main [& _]
  (let [feed "resources/feeds/sample.csv"
        out (format "resources/candidates/autofetch-%s.edn" (today))
        candidates (map ic/normalize-track (ic/parse-csv feed))]
    (io/make-parents out)
    (ic/write-edn out (vec candidates))))
