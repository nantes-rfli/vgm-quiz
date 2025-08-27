(ns vgm.autofetch
  (:require [vgm.import-csv :as ic]
            [vgm.ingest :as ingest])
  (:import (java.time LocalDate)
           (java.time.format DateTimeFormatter)))

(defn -main [& _]
  (let [in "resources/feeds/sample.csv"
        stamp (.format (DateTimeFormatter/ofPattern "yyyyMMdd") (LocalDate/now))
        out (format "resources/candidates/autofetch-%s.edn" stamp)
        candidates (->> (ic/parse-csv in)
                        (map ingest/normalize-track))]
    (ic/write-edn out candidates)
    (println (format "autofetch: wrote %d candidates -> %s"
                     (count candidates) out))))
