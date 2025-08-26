(ns vgm.core-shared-test
  (:require [clojure.test :refer :all]
            [vgm.core-shared :as sut]))

(deftest normalize-basic
  (is (= "hello" (sut/normalize "  HeLLo  "))))

(deftest canonical-basic
  (is (= "world" (sut/canonical {"hello" "world"} "HELLO"))))
