(ns vgm.core-shared
  (:require [clojure.string :as str]))

(defn normalize
  "Normalize a string using NFKC, trim, and lower-case."
  [s]
  (let [s (str (or s ""))
        s #?(:clj  (java.text.Normalizer/normalize s java.text.Normalizer$Form/NFKC)
               :cljs (.normalize s "NFKC"))]
    (-> s str/trim str/lower-case)))

(defn canonical
  "Return canonical form of `s` using normalized alias map `aliases`."
  [aliases s]
  (let [norm (normalize s)]
    (get aliases norm norm)))
