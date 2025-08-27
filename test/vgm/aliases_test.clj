(ns vgm.aliases-test
  (:require [clojure.test :refer :all]
            [vgm.aliases :as sut]))

(deftest merge-proposals-basic
  (let [aliases   {:game {"dragon quest" #{"dq"}}}
        proposals {:game {"dragon quest" #{"ドラゴンクエスト" "dq"}}
                   :composer {"toby fox" #{"トビー・フォックス"}}}
        {:keys [result added total-added]} (sut/merge-proposals aliases proposals)]
    (is (= #{"dq" "ドラゴンクエスト"}
           (get-in result [:game "dragon quest"])))
    (is (= 1 (get-in added [:game "dragon quest"])))
    (is (= 1 (get-in added [:composer "toby fox"])))
    (is (= 2 total-added))))
