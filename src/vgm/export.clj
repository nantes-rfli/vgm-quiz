(ns vgm.export
  "Export questions for みんはや freematch."
  (:require [clojure.string :as str]
            [vgm.core :as core]
            [vgm.question-pipeline :as qp]))

(defn build-questions
  "Generate N questions using the existing pipeline.

  Returns a vector of maps with keys :prompt, :answer and :explanation.
  Accepts an optional opts map which is forwarded to
  `vgm.question-pipeline/pick-questions`."
  ([n] (build-questions n {}))
  ([n opts]
   (let [tracks (core/load-tracks)
         _ (assert (core/valid-dataset? tracks) "Invalid dataset")
         {:keys [items]} (qp/pick-questions tracks
                                            (merge {:n n
                                                    :distinct-by [:title :game :composer]
                                                    :spread-by :year-bucket
                                                    :qtypes [:title->game :game->composer :title->composer]}
                                                   opts))]
     (->> items
          (map (fn [{:keys [track qtype]}]
                 (let [{:keys [prompt answer]} (core/make-question qtype track)
                       explanation (str (:year track) " / " (:composer track))]
                   {:prompt prompt
                    :answer answer
                    :explanation explanation})))
          vec))))

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

(defn to-minhaya-csv
  "Return CSV for みんはや with header question,answer,explanation."
  [items]
  (let [rows (map (fn [{:keys [prompt answer explanation]}]
                    (str (escape-csv prompt) ","
                         (escape-csv answer) ","
                         (escape-csv (or explanation ""))))
                  items)]
    (str "question,answer,explanation\n" (str/join "\n" rows))))
