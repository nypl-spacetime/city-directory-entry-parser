from cdparser.Utils import Utils

class LabeledEntry:
    def __init__(self, input_string, input_tokens=None):
        self.original_string = input_string
        self.tokens = input_tokens or Utils.label_tokenize(input_string)
        self.token_labels = []
        self.is_parsed = False
        self.categories = None

    def reduce_labels(self):
        if self.categories == None:
            categories = {
                'subjects': [],
                'occupations': [],
                'addresses': []
            }
            current_label = None
            current_entity = ""
            current_predicate = ""
            for label, token_tuple in zip(self.token_labels, self.tokens):
                if current_label == label:
                    current_entity += " " + token_tuple[0]
                else:
                    if current_label == 'NC':
                        categories['subjects'].append(current_entity)
                    elif current_label == 'OC':
                        categories['occupations'].append(current_entity)
                    elif current_label == 'AC':
                        address = [current_entity]
                        if len(current_predicate) != 0:
                            address.append(current_predicate)
                            current_predicate = ""
                        categories['addresses'].append(address)
                    current_entity = ""
                    current_label = label
                    if current_label == "PA":
                        current_predicate += token_tuple[0]
                    else:
                        current_entity += token_tuple[0]
            self.categories = categories
            return self

    def __str__(self):
        if self.is_parsed:
            return Utils.to_pretty_string(self.tokens, self.token_labels)
        else:
            return self.original_string