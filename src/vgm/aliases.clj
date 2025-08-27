(ns vgm.aliases
  (:gen-class)
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.set :as set]
            [vgm.core-shared :as shared]))

(defn- canonicalize [m]
  (into {}
        (for [[cat entries] m]
          [cat
           (into {}
                 (for [[canon aliases] entries]
                   [(shared/normalize canon)
                    (set (map shared/normalize aliases))]))]))

(defn- merge-aliases [base props]
  (merge-with
    (fn [m1 m2]
      (merge-with set/union m1 m2))
    base props))

(defn- diff-stats [base props]
  (into {}
        (for [[cat entries] props]
          (let [base-entries (get base cat {})]
            [cat {:added   (count (remove #(contains? base-entries %) (keys entries)))
                  :updated (count (filter (fn [k]
                                            (let [new (get entries k)
                                                  old (get base-entries k #{})]
                                              (not (set/subset? new old))))
                                          (filter #(contains? base-entries %) (keys entries))))}]))))

(defn merge-proposals [aliases proposals]
  (let [aliases   (canonicalize aliases)
        proposals (canonicalize proposals)
        merged    (merge-aliases aliases proposals)]
    {:merged merged
     :stats  (diff-stats aliases proposals)}))

(defn- stats-table [stats]
  (let [header "| Category | Added | Updated |\n|---|---:|---:|\n"]
    (str header
         (apply str
                (for [[cat {:keys [added updated]}] (sort-by key stats)]
                  (format "| %s | %d | %d |\n" (name cat) added updated))))))

(defn -main [& args]
  (let [[cmd & more] args]
    (case cmd
      "merge" (let [aliases-path (last more)
                     props-files  (butlast more)
                     proposals    (reduce (fn [acc f]
                                            (merge-aliases acc (canonicalize (edn/read-string (slurp f)))))
                                          {}
                                          props-files)
                     aliases      (if (.exists (io/file aliases-path))
                                    (edn/read-string (slurp aliases-path))
                                    {})
                     {:keys [merged stats]} (merge-proposals aliases proposals)]
                 (spit aliases-path (pr-str merged))
                 (println (stats-table stats)))
      (do
        (binding [*out* *err*]
          (println "Unknown command" cmd)
          (println "Usage: merge <proposals.edn>... <aliases.edn>"))
        (System/exit 1)))))
