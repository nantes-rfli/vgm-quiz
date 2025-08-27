(ns vgm.ingest-test
  (:require [clojure.test :refer [deftest is testing]]
            [vgm.ingest :as sut]))

(deftest normalize-track-test
  (let [m {:title " Ｔｅｓｔ "
           :game " ｹﾞｰﾑ "
           :composer "ＣｏｍＰoSeR "
           :year "２０００"}
        r (sut/normalize-track m)]
    (is (= {:title "test"
            :game "ゲーム"
            :composer "composer"
            :year 2000}
           r))))

(deftest merge-unique-test
  (let [existing [{:title "t" :game "g" :composer "c" :year 2000}]
        new [{:title "t" :game "g" :composer "c" :year 2000}
             {:title "u" :game "g" :composer "c" :year 2001}]
        merged (sut/merge-unique existing new)]
    (is (= 2 (count merged)))
    (is (= 1 (count (filter #(= "t" (:title %)) merged))))))

(deftest sort-tracks-stable-test
  (let [a {:title "a" :game "g" :composer "c" :year 2000}
        b {:title "a" :game "g" :composer "c" :year 2000}
        xs [a b]
        s1 (sut/sort-tracks xs)
        s2 (sut/sort-tracks s1)]
    (is (= s1 s2))
    (is (= [a b] s1))))
