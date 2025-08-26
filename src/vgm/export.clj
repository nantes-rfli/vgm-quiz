(ns vgm.export
  "Export questions for みんはや freematch."
  (:require [clojure.string :as str]
            [vgm.core :as core]
            [vgm.question-pipeline :as qp]))

(defn build-questions
  "Generate N questions using the existing pipeline."
  [n]
  (let [tracks (core/load-tracks)
        _ (assert (core/valid-dataset? tracks) "Invalid dataset")
        {:keys [items]} (qp/pick-questions tracks
                                           {:n n
                                            :distinct-by [:title :game :composer]
                                            :spread-by :year-bucket
                                            :qtypes [:title->game :game->composer :title->composer]})]
    (->> items
         (map (fn [{:keys [track qtype]}]
                (core/make-question qtype track)))
         vec)))

(defn to-plain
  "Return plain text with one question per line: prompt\tanswer."
  [items]
  (->> items
       (map (fn [{:keys [prompt answer]}]
              (str prompt "\t" answer)))
       (str/join "\n")))

(defn- escape-csv [s]
  (str "\"" (str/replace s #"\"" "\"\"") "\""))

(defn to-csv
  "Return CSV with header question,answer."
  [items]
  (let [rows (map (fn [{:keys [prompt answer]}]
                    (str (escape-csv prompt) "," (escape-csv answer)))
                  items)]
    (str "question,answer\n" (str/join "\n" rows))))
