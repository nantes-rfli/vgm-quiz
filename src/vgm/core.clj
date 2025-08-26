(ns vgm.core
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.string :as str]
            [malli.core :as m])
  (:import (java.text Normalizer Normalizer$Form)))


;; ----- スキーマ ------------------------------------------------------------


(def Track
  [:map
   [:title string?]
   [:game string?]
   [:composer string?]
   [:year int?]])


(def Tracks [:vector Track])


;; ----- データ入出力 -------------------------------------------------------


(defn load-tracks []
  (with-open [r (io/reader (io/resource "data/tracks.edn"))]
    (edn/read (java.io.PushbackReader. r))))


(defn valid-dataset? [tracks]
  (m/validate Tracks tracks))


;; --- 同義語辞書の読み込み＆正規化 ----------------------------------------


(defn- nfkc [^CharSequence s]
(Normalizer/normalize (str s) Normalizer$Form/NFKC))


(defn base-normalize [s]
(-> s (or "") nfkc str/trim str/lower-case))


(defn load-aliases []
(when-let [res (io/resource "data/aliases.edn")]
(with-open [r (io/reader res)]
(edn/read (java.io.PushbackReader. r)))))


(defn- invert-aliases
"{:game {canon #{a1 a2}} ...} → {normalized-alias canon, ...}"
[aliases]
(into {}
(for [[_cat m] aliases
[canon vs] m
:let [canon* (base-normalize canon)]
v (conj vs canon)]
[(base-normalize v) canon*])))


(defonce ^:private !alias-map (atom nil))


(defn- ensure-alias-map []
(or @!alias-map
(reset! !alias-map (invert-aliases (or (load-aliases) {})))))


(defn canonical [s]
(let [b (base-normalize s)
amap (ensure-alias-map)]
(get amap b b)))


;; ----- 問題生成 ------------------------------------------------------------


(def ^:private qtypes [:title->game :game->composer :title->composer])


(defn normalize [s]
  (base-normalize s))


(defn make-question
  ([track] (make-question (rand-nth qtypes) track))
  ([qtype track]
   (case qtype
     :title->game
     {:prompt (str "この曲の収録作品は？: " (:title track))
      :answer (:game track) :type qtype :track track}


     :game->composer
     {:prompt (str "この作品の作曲者は？: " (:game track))
      :answer (:composer track) :type qtype :track track}


     :title->composer
     {:prompt (str "この曲の作曲者は？: " (:title track))
      :answer (:composer track) :type qtype :track track})))


(defn correct-answer? [expected user]
  (= (canonical expected) (canonical user)))


;; ----- クイズ実行（CLI用） -------------------------------------------------


(defn run-quiz!
  "N問だけ標準入出力で出題して得点を返す。"
  [n]
  (let [tracks (load-tracks)]
    (assert (valid-dataset? tracks) "Invalid dataset")
    (loop [i 0 score 0]
      (if (= i n)
        (do (println "Score:" score "/" n) score)
        (let [t (rand-nth tracks)
              q (make-question t)]
          (println (:prompt q))
          (print "> ") (flush)
          (let [user (read-line)
                ok? (correct-answer? (:answer q) user)]
            (println (if ok? "✅ 正解!" (str "❌ 正解: " (:answer q))))
            (recur (inc i) (if ok? (inc score) score))))))))