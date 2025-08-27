(ns vgm.export-test
  (:require [clojure.test :refer :all]
            [clojure.string :as str]
            [vgm.export :as sut]))

(deftest minhaya-csv
  (let [items (sut/build-questions 3 {})
        csv (sut/to-minhaya-csv items)
        lines (str/split-lines csv)]
    (is (= "question,answer,explanation" (first lines)))
    (is (= 4 (count lines)))
    (doseq [line (rest lines)]
      (let [[q a _] (str/split line #"," 3)]
        (is (not (str/blank? q)))
        (is (not (str/blank? a)))))))
