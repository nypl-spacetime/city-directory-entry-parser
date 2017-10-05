class Utils:
    @staticmethod
    def label_tokenize(input):
        return list(map(lambda x: (x, None), Utils.tokenize(input, True)))

    @staticmethod
    def tokenize(input, append_start_end=False):
        tokens = ['START'] if append_start_end else []
        buffer = ''
        for elem in input:
            if elem == '.' or elem == ',' or elem == '&':
                if len(buffer) > 0:
                    tokens.append(buffer)
                    buffer = ''
                tokens.append(elem)
            elif elem == ' ':
                if len(buffer) > 0:
                    tokens.append(buffer)
                    buffer = ''
            else:
                buffer += elem
        if len(buffer) > 0:
            tokens.append(buffer)
        if append_start_end:
            tokens.append('END')
        return tokens

    @staticmethod
    def to_pretty_string(original_tokens, token_labels):
        text = ""
        if len(original_tokens) == len(token_labels):
            for i in range(0, len(original_tokens)):
                tag = token_labels[i]
                color = Utils.TAG_MAP[tag]
                text += Utils.COLORS[color].format(original_tokens[i][0]) + " "
        return text

    COLORS = {
        'white': "\033[0;37m{}\033[0m",
        'yellow': "\033[0;33m{}\033[0m",
        'green': "\033[0;32m{}\033[0m",
        'blue': "\033[0;34m{}\033[0m",
        'cyan': "\033[0;36m{}\033[0m",
        'red': "\033[0;31m{}\033[0m",
        'magenta': "\033[0;35m{}\033[0m",
        'black': "\033[0;30m{}\033[0m",
        'darkwhite': "\033[1;37m{}\033[0m",
        'darkyellow': "\033[1;33m{}\033[0m",
        'darkgreen': "\033[1;32m{}\033[0m",
        'darkblue': "\033[1;34m{}\033[0m",
        'darkcyan': "\033[1;36m{}\033[0m",
        'darkred': "\033[1;31m{}\033[0m",
        'darkmagenta': "\033[1;35m{}\033[0m",
        'hilite': "\x1b[93;41m{}\033[0m",
        'darkblack': "\033[1;30m{}\033[0m",
        'off': "\033[0;0m{}\033[0m"
    }

    TAG_MAP = {
        'NC': 'green',
        'OC': 'blue',
        'AC': 'red',
        'PA': 'darkcyan',
        'START': 'darkyellow',
        'D': 'darkmagenta',
        'X': 'black',
        'END': 'darkyellow',
    }
