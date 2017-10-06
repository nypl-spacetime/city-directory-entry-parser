import csv
import fileinput
import json
import sys
from cdparser.Features import Features
from cdparser.LabeledEntry import LabeledEntry
import sklearn_crfsuite
from sklearn_crfsuite import metrics

class Classifier:
    def __init__ (self, training_data=None):
        self.training_set_labeled = []
        self.training_set_features = []
        self.training_set_labels = []
        self.validation_set_labeled = []
        self.validation_set_features = []
        self.validation_set_labels = []
        self.crf = None

    def load_labeled_data(self, path_to_csv, rows_to_ignore=0):
        rows = []
        labeled_data = []
        with open(path_to_csv, 'r') as csvfile:
            rdr = csv.reader(csvfile)
            index = -1
            for row in rdr:
                index += 1
                if index >= rows_to_ignore:
                    rows.append(row)
        example_number = -1
        example = None
        for row in rows:
            sentence_number = int(row[0])
            if sentence_number > example_number:
                example_number = sentence_number
                if example == None:
                    example = []
                else:
                    labeled_data.append(example)
                    example = []
            example.append((row[1], row[2]))
        labeled_data.append(example)
        return labeled_data

    def listen(self):
        for line in fileinput.input(sys.argv[3:]):
            entry = LabeledEntry(line.rstrip())
            print(json.dumps(self.label(entry).categories))

    def load_training(self, path_to_csv, rows_to_ignore=0):
        self.training_set_labeled = self.load_labeled_data(path_to_csv, rows_to_ignore)
        self.__process_training_data()

    def load_validation(self, path_to_csv, rows_to_ignore=0):
        self.validation_set_labeled = self.load_labeled_data(path_to_csv, rows_to_ignore)
        self.__process_validation_data()

    def __process_training_data(self):
        self.training_set_features = [Features.get_sentence_features(s) for s in self.training_set_labeled]
        self.training_set_labels = [Features.get_sentence_labels(s) for s in self.training_set_labeled]

    def __process_validation_data(self):
        self.validation_set_features = [Features.get_sentence_features(s) for s in self.validation_set_labeled]
        self.validation_set_labels = [Features.get_sentence_labels(s) for s in self.validation_set_labeled]

    def train(self):
        self.crf = sklearn_crfsuite.CRF(
            algorithm='lbfgs',
            c1=0.1,
            c2=0.1,
            max_iterations=1000,
            all_possible_transitions=False,
            verbose=False
            )
        self.crf.fit(self.training_set_features, self.training_set_labels)

    def validation_metrics(self):
        labels = list(self.crf.classes_)
        validation_predictions = self.crf.predict(self.validation_set_features)
        return metrics.flat_f1_score(self.validation_set_labels, validation_predictions, average='weighted', labels=labels)

    def print_validation_metrics_per_class(self):
        validation_predictions = self.crf.predict(self.validation_set_features)
        sorted_labels = sorted(
            list(self.crf.classes_),
            key=lambda name: (name[1:], name[0])
        )
        print(metrics.flat_classification_report(
            self.validation_set_labels, validation_predictions, labels=sorted_labels, digits=5
        ))

    def predict_labeled_tokens(self, labeled_tokens):
        features_set = [Features.get_sentence_features(labeled_tokens)]
        return self.crf.predict(features_set)[0]

    def label(self, labeled_entry):
        if isinstance(labeled_entry, list):
            return list(self.label(x) for x in labeled_entry)
        else:
            labeled_entry.token_labels = self.predict_labeled_tokens(labeled_entry.tokens)
            labeled_entry.is_parsed = True
            labeled_entry.reduce_labels()
            return labeled_entry