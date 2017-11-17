from cdparser.Utils import Utils

class LabeledEntry:
    def __init__(self, input_string, input_tokens=None):
        self.original_string = input_string
        self.tokens = input_tokens or Utils.label_tokenize(input_string)
        self.token_labels = []
        self.is_parsed = False
        self.categories = None

    # reduce_labels() creates a best-guess record from a sequence of predicted labels
    def reduce_labels(self):
        if self.categories == None:
            categories = {
                'subjects': [],
                'occupations': [],
                'locations': []
            }
            # We use the three vars below to construct record inputs as we iterate
            # through the sequence of labels
            constructing_label = None
            constructing_entity = ""
            constructing_predicate = ""
            for label, token_tuple in zip(self.token_labels, self.tokens):
                token = token_tuple[0] # 'token' gets the actual text of the token
                if constructing_label == label:
                    # If the previously seen label is the same as the current, we simply append
                    if constructing_label == "PA":
                        constructing_predicate += " " + token
                    else:
                        constructing_entity += " " + token
                else:
                    # Otherwise, we have a new label, and have to clean up when is currently
                    # stored in the 'constructing_' vars...
                    if constructing_label == 'NC':
                        categories['subjects'].append(constructing_entity)
                    elif constructing_label == 'OC':
                        categories['occupations'].append(constructing_entity)
                    elif constructing_label == 'AC':
                        location = {'value': constructing_entity}
                        if len(constructing_predicate) != 0:
                            location['labels'] = list(filter(None, constructing_predicate.split(" .")))
                            constructing_predicate = ""
                        categories['locations'].append(location)
                    constructing_entity = ""
                    constructing_label = label
                    if constructing_label == "PA":
                        constructing_predicate += token
                    else:
                        constructing_entity += token
            self.categories = categories
            return self

    def __str__(self):
        if self.is_parsed:
            return Utils.to_pretty_string(self.tokens, self.token_labels)
        else:
            return self.original_string