(ns vgm.question-pipeline-test
  (:require [clojure.test :refer :all]
            [vgm.question-pipeline :as qp]))

(def sample-tracks
  [;; bucket 1995
   {:title "t1" :game "g1" :composer "c1" :year 1995}
   {:title "t2" :game "g2" :composer "c2" :year 1996}
   ;; bucket 2000
   {:title "t3" :game "g3" :composer "c3" :year 2001}
   {:title "t4" :game "g4" :composer "c4" :year 2002}
   ;; duplicate of t1
   {:title "t1" :game "g1" :composer "c1" :year 1995}
   ;; bucket 2010
   {:title "t5" :game "g5" :composer "c5" :year 2010}
   {:title "t6" :game "g6" :composer "c6" :year 2011}])

(deftest pick-questions-basic
  (with-redefs [shuffle identity]
    (let [opts {:n 4
                :distinct-by [:title :game :composer]
                :spread-by :year-bucket
                :qtypes #{:title->game :game->composer}}
          res (qp/pick-questions sample-tracks opts)
          items (:items res)]
      (is (= 4 (count items)))
      ;; no duplicates by distinct-by keys
      (is (= 4 (->> items
                    (map :track)
                    (map (juxt :title :game :composer))
                    distinct
                    count)))
      ;; bucket distribution not overly skewed
      (let [bucket-counts (vals (get-in res [:stats :by-bucket]))
            max-cnt (apply max bucket-counts)
            limit (int (Math/ceil (/ (:n opts) 2.0)))]
        (is (<= max-cnt limit))))))

