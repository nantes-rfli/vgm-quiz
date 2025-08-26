(ns dataset-no-legacy-id-test
  (:require [clojure.test :refer :all]
            [clojure.java.io :as io]
            [clojure.data.json :as json]))

(deftest no-legacy-id-key
  ;; CI runs `-T:build publish` beforehand
  (let [data (-> (slurp (io/file "public/build/dataset.json"))
                 (json/read-str :key-fn keyword))
        bad  (filter :id (:tracks data))]
    (is (empty? bad) "legacy :id should not appear in tracks")))
