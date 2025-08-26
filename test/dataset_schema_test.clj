(ns dataset-schema-test
  (:require [clojure.test :refer [deftest is]]
            [clojure.data.json :as json]
            [malli.core :as m]))

(def dataset-schema
  [:map
   [:dataset_version int?]
   [:generated_at string?]
   [:tracks
    [:vector
     [:map
      [:title string?]
      [:game string?]
      [:composer string?]
      [:year int?]
      [:track/id string?]]]]])

(deftest dataset-json-conforms-to-schema
  (let [data (-> "public/build/dataset.json" slurp (json/read-str :key-fn keyword))]
    (is (m/validate dataset-schema data))))
