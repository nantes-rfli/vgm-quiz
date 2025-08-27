(ns vgm.aliases-test
  (:require [clojure.test :refer [deftest is]]
            [vgm.aliases :as aliases]))

(deftest merge-proposals-test
  (let [aliases   {:game {"dragon quest" #{"dq"}}}
        proposals {:game {"Dragon Quest" ["ドラゴンクエスト"]
                           "ゼルダの伝説" ["ゼルダ"]}}
        {:keys [merged stats]} (aliases/merge-proposals aliases proposals)]
    (is (= #{"dq" "ドラゴンクエスト"}
           (get-in merged [:game "dragon quest"])))
    (is (= #{"ゼルダ"}
           (get-in merged [:game "ゼルダの伝説"])))
    (is (= {:game {:added 1 :updated 1}}
           stats))))
