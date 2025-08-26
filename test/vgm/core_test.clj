(ns vgm.core-test
  (:require [clojure.test :refer :all]
            [vgm.core :as sut]))


(deftest dataset-valid?
  (let [ts (sut/load-tracks)]
    (is (pos? (count ts)))
    (is (sut/valid-dataset? ts))))


(deftest question-shape
  (let [t (first (sut/load-tracks))
        q (sut/make-question :title->game t)]
    (is (string? (:prompt q)))
    (is (string? (:answer q)))
    (is (= :title->game (:type q)))))


(deftest normalize-and-judge
  (is (true? (sut/correct-answer? "UNDERTALE" " undertale ")))
  (is (true? (sut/correct-answer? "光田康典" "光田康典")))
  (is (false? (sut/correct-answer? "Toby Fox" "Tobi Fox"))))


(deftest alias-judgement
  (testing "ゲーム名の別名"
    (is (sut/correct-answer? "ドラゴンクエスト" "DQ"))
    (is (sut/correct-answer? "ゼルダの伝説" "legend of zelda")))
  (testing "作曲者の別表記"
    (is (sut/correct-answer? "Toby Fox" "トビー・フォックス"))
    (is (sut/correct-answer? "近藤浩治" "koji kondo"))))