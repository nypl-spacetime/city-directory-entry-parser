from functools import partial

class Features:

    @staticmethod
    def __emit_word_features(rel_pos, word):
        features = {}
        for f in Features.__word_feature_functions().items():
            features.update({str(rel_pos) + ":" + f[0]: f[1](word)})
        return features

    @staticmethod
    def get_word_features(sentence,i):
        features = {}
        for x in range(i - 2, i + 3):
            if 0 <= x < len(sentence):
                features.update(Features.__emit_word_features(-(i - x), sentence[x][0]))
        if i == 0:
            features.update({'BOS' : True})
        if i == len(sentence) - 1:
            features.update({'EOS': True})
        return features

    @staticmethod
    def __word_feature_functions():
        return {
            "word.junior": Features.__is_junior_token,
            "word.widow.token": Features.__is_widow_token,
            "word.contains.digit": Features.__contains_digit,
            "word.is.delimiter": Features.__is_delimiter,
            "word.is.start.token": Features.__is_start,
            "word.is.end.token": Features.__is_end,
            "word.is.lower": str.islower,
            "word.is.title": str.istitle,
            "word.is.upper": str.isupper,
            "word.substr[-2:]" : partial(Features.__substr, 2),
            "word.substr[-1:]": partial(Features.__substr, 1)
        }

    @staticmethod
    def get_sentence_features(sentence):
        return [Features.get_word_features(sentence, i) for i in range(len(sentence))]

    @staticmethod
    def get_sentence_labels(sentence):
        return [label for token, label in sentence]

    @staticmethod
    def get_sentence_tokens(sentence):
        return [token for token, label in sentence]

    @staticmethod
    def __contains_digit(input):
        for c in input:
            if c.isdigit():
                return True
        return False

    @staticmethod
    def __substr(amount, word):
        return word[amount:]

    @staticmethod
    def __is_start(input):
        if input == "START":
            return True
        return False

    @staticmethod
    def __is_end(input):
        if input == "END":
            return True
        return False

    @staticmethod
    def __is_delimiter(input):
        for c in input:
            if c == '.' or c == ',':
                return True
        return False

    @staticmethod
    def __is_known_position_adj(input):
        if len(input) == 1:
            if input == 'h' or input == 'r':
                return True
        return False

    @staticmethod
    def __is_junior_token(input):
        dc = input.lower()
        if dc == "jr":
            return True
        return False

    @staticmethod
    def __segment_of_sentence(sent, i, div):
        sent_length = len(sent)
        pos = i + 1
        for j in range(1,div + 1):
            if pos <= j*(sent_length / float(div)):
                return j

    @staticmethod
    def __is_widow_token(input):
        dc = input.lower()
        if dc == "wid" or dc == "widow":
            return True
        return False