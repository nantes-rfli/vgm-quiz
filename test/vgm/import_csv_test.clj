(ns vgm.import-csv-test
  (:require [clojure.test :refer :all]
            [vgm.import-csv :as ic]
            [clojure.java.io :as io]))

(deftest parse-basic-csv
  (let [f (java.io.File/createTempFile "ic" ".csv")]
    (.deleteOnExit f)
    (spit f "title,game,composer,year\nMegalovania,UNDERTALE,Toby Fox,2015\n")
    (let [xs (vec (ic/parse-csv (.getPath f)))]
      (is (= 1 (count xs)))
      (is (= 2015 (:year (first xs))))
      (is (= "UNDERTALE" (:game (first xs)))))))
