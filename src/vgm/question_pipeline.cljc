(ns vgm.question-pipeline
  "Pure question selection pipeline.")

(defn year-bucket
  "Bucketize YEAR into 5-year spans (e.g. 1996 -> 1995)."
  [year]
  (when (number? year)
    (* 5 (quot year 5))))

(defn- distinct-by*
  "Return lazy sequence of COLL without duplicates according to key function KF."
  [kf coll]
  (let [seen (volatile! #{})]
    (filter (fn [x]
              (let [k (kf x)]
                (if (@seen k)
                  false
                  (do (vswap! seen conj k) true))))
            coll)))

(defn pick-questions
  "Select N tracks with options.
  Options:
    :n            number of questions
    :distinct-by  vector of keys to prevent duplicates
    :spread-by    keyword; currently supports :year-bucket
    :qtypes       collection of question types (cycled)
  Returns {:items [{:track t :qtype q} ...]
           :stats {:by-bucket {bucket cnt}
                   :by-qtype {qtype cnt}}}"
  [tracks {:keys [n distinct-by spread-by qtypes]}]
  (let [kfn (apply juxt distinct-by)
        tracks (->> tracks (distinct-by* kfn))
        bucket-fn (case spread-by
                    :year-bucket #(year-bucket (:year %))
                    spread-by)
        groups (->> tracks (group-by bucket-fn)
                    (into {} (map (fn [[k v]] [k (shuffle v)]))))
        order (shuffle (keys groups))
        qcycle (cycle (shuffle (vec qtypes)))
        items (loop [items []
                     groups groups
                     order (cycle order)
                     qts qcycle]
                (if (or (= (count items) n) (empty? groups))
                  items
                  (let [b (first order)]
                    (if-let [ts (seq (get groups b))]
                      (let [t (first ts)
                            remaining (next ts)
                            groups* (if remaining (assoc groups b remaining) (dissoc groups b))]
                        (recur (conj items {:track t :qtype (first qts)})
                               groups*
                               (rest order)
                               (rest qts)))
                      (recur items (dissoc groups b) (rest order) qts)))))
        by-bucket (frequencies (map #(bucket-fn (:track %)) items))
        by-qtype (frequencies (map :qtype items))]
    {:items items
     :stats {:by-bucket by-bucket
             :by-qtype by-qtype}}))

