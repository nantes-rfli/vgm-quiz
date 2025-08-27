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

(defn merge-proposals! [props-path aliases-path]
  (let [props    (canonicalize (edn/read-string (slurp props-path)))
        aliases  (if (.exists (io/file aliases-path))
                   (edn/read-string (slurp aliases-path))
                   {})
        merged   (merge-aliases aliases props)
        bak-path (str aliases-path ".bak")]
    (when (.exists (io/file aliases-path))
      (io/copy (io/file aliases-path) (io/file bak-path)))
    (spit aliases-path (pr-str merged))))

(defn -main [& args]
  (let [[cmd props aliases] args]
    (case cmd
      "merge-proposals" (merge-proposals! props aliases)
      (do
        (binding [*out* *err*]
          (println "Unknown command" cmd)
          (println "Usage: merge-proposals <proposals.edn> <aliases.edn>"))
        (System/exit 1)))))
