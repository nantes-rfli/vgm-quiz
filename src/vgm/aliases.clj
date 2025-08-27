(ns vgm.aliases
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.pprint :as pp]
            [clojure.string :as str]
            [clojure.set :as set])
  (:import (java.io PushbackReader)
           (java.text Normalizer Normalizer$Form)))

;; --- I/O helpers -----------------------------------------------------------

(defn- read-edn-file [path]
  (let [f (io/file path)]
    (when (.exists f)
      (with-open [r (io/reader f)]
        (edn/read (PushbackReader. r))))))

(defn- write-edn-file [path data]
  (let [f (io/file path)]
    (when-let [dir (.getParentFile f)]
      (.mkdirs dir))
    (spit f (with-out-str (pp/pprint data)))))

;; --- Normalization (match core canonicalization) ---------------------------

(defn- nfkc [s]
  (Normalizer/normalize (str s) Normalizer$Form/NFKC))

(defn- base-normalize [s]
  (-> s nfkc str/trim str/lower-case))

;; Ensure {:game {:canon #{aliases}} :composer {...}} with sets and normalized keys/values.
(defn- normalize-alias-map [m]
  (letfn [(norm-cat [cat-map]
            (reduce
              (fn [acc [canon aliases]]
                (let [canon* (base-normalize canon)
                      set*   (into #{} (map base-normalize) (or aliases #{}))
                      prev   (get acc canon* #{})
                      merged (into prev set*)]
                  (assoc acc canon* merged)))
              {}
              (or cat-map {})))]
    {:game     (norm-cat (:game m))
     :composer (norm-cat (:composer m))}))

;; --- Merge -----------------------------------------------------------------

(defn merge-proposals
  "Merge proposals into existing aliases.
   Returns {:result <merged> :added {cat {canon n}} :total-added n}."
  [aliases proposals]
  (let [A (normalize-alias-map (or aliases {}))
        P (normalize-alias-map (or proposals {}))
        cats [:game :composer]
        result (reduce
                 (fn [acc cat]
                   (update acc cat
                           (fn [am]
                             (reduce (fn [am* [canon pset]]
                                       (update am* canon (fnil into #{}) pset))
                                     (or am {})
                                     (get P cat {})))))
                 A
                 cats)
        added  (into {}
                     (for [cat cats]
                       [cat
                        (into {}
                              (for [[canon pset] (get P cat {})]
                                (let [before (get-in A [cat canon] #{})
                                      diff   (set/difference pset before)]
                                  [canon (count diff)]))]))
        total-added (reduce + 0 (mapcat vals (vals added)))]
    {:result result :added added :total-added total-added}))

;; --- CLI -------------------------------------------------------------------

(defn -main [& [cmd proposals-path aliases-path]]
  (case cmd
    "merge"
    (let [proposals (or (and proposals-path (read-edn-file proposals-path)) {})
          aliases   (or (and aliases-path   (read-edn-file aliases-path))   {})
          {:keys [result added total-added]} (merge-proposals aliases proposals)
          out (or aliases-path "resources/data/aliases.edn")]
      (write-edn-file out result)
      (println (format "aliases merged → %s (added %d)" out total-added))
      (doseq [cat [:game :composer]]
        (let [m (get added cat)
              m' (into {} (remove (comp zero? val)) m)]
          (when (seq m')
            (println (name cat) ":" m'))))
      (shutdown-agents))
    (do
      (println "Usage: clojure -M -m vgm.aliases merge <proposals.edn> <aliases.edn>")
      (shutdown-agents))))
