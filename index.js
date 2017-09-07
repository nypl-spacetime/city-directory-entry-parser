const path = require('path')
const R = require('ramda')
const lunr = require('lunr')

// Create occupations index using lunr
const occupations = require(path.join(__dirname, 'data', 'consolidated-occupations.json'))
const job_idx = lunr(function () {
  this.ref('id')
  this.field('value')

  occupations.forEach(function (doc) {
    this.add(doc)
  }, this)
})

function job_probability_score (token, index) {
  if (index.search(token).length > 0) {
    return 1.5
  } else if (index.search(`${token}~1`).length > 0) {
    return 1.0
  } else if (index.search(`${token}~2`).length > 0) {
    return 0.9
  } else if (index.search(`${token}~4`).length > 0) {
    return 0.5
  } else {
    return -0.5
  }
}

/* Class contains heuristic helper functions
   for labeling tokens */
class TokenInterpret {
  static contains_numbers (token) {
    return /\d/.test(token)
  }
  static matches_cardinal_dir (token) {
    return /^(s|S|w|W|e|E|n|N).{0,1}$/.test(token)
  }
  static no_white_space (token) {
    return !/^\S*(\s)+\S*$/.test(token)
  }
  static is_short (token) {
    return (token.length < 2)
  }
  static could_be_abbreviation (token, index) {
    return (token.length == 1 && index > 0)
  }
  static probably_job (token) {
    return true
  }
  static percent_uppercase (token) {
    return token.replace(/ /g, '').split('').map((char) => {
      return char.toUpperCase() == char && isNaN(char)
    }).reduce((acc, val) => {
      return acc + (!!val ? 1 : 0)
    }, 0) / token.replace(/ /g, '').length
  }
  static is_known_predicate (token) {
    return /^(wid|h|r).?$/i.test(token)
  }
}

class InterpretedLine {
  constructor (original_ocr_object) {
    this.o_object = original_ocr_object
    this.o_text = this.o_object['text']
  }
}

function tokenize (line) {
  t1 = line.split(/(,|\.\s)/).map((elem) => {
    return elem.trim()
  })
  t2 = t1.filter((elem) => {
    return !(/^\s*[,\.]\s*$/.test(elem))
  })
  t3 = []
  t2.forEach(function (token) {
    t3 = t3.concat(jitter_split(token))
  })
  t3 = t3.filter((elem) => {
    return elem.length > 0
  })
  return t3
}

/* Split token into two if begins or ends with a single character */
function jitter_split (token) {
  if (token.slice(1, 2) == ' ' && token.slice(-2, -1) == ' ') {
    return [token.slice(0, 1), token.slice(2, -2), token.slice(-1)]
  } else if (token.slice(1, 2) == ' ') {
    return [token.slice(0, 1), token.slice(2)]
  } else if (token.slice(-2, -1) == ' ') {
    return [token.slice(0, -2), token.slice(-1)]
  } else {
    return [token]
  }
}

function category_vote (ordered_token_array) {
  decisions = ordered_token_array.map((token, i) => {
    return {
      'token': token,
      'index': i,
      'votes': []
    }
  })
  ordered_token_array.forEach(function (token, i) {
    if (TokenInterpret.is_short(token)) {
      decisions[i]['votes'].push({
        'predicate': 1.9
      })
    }
    if (TokenInterpret.is_known_predicate(token)) {
      decisions[i]['votes'].push({
        'predicate': 1.9
      })
    }
    if (TokenInterpret.contains_numbers(token)) {
      decisions[i]['votes'].push({
        'address_component': 2.0
      })
    }
    if (i == 0) {
      decisions[i]['votes'].push({
        'name_component': 1.0
      })
      if (!TokenInterpret.contains_numbers(token)) {
        decisions[i]['votes'].push({
          'name_component': 1.0
        })
      }
    } // End first token
    if (token.length > 2 && TokenInterpret.percent_uppercase(token) > 0.5) {
      decisions[i]['votes'].push({
        'name_component': 2.0
      })
    }
    decisions[i]['votes'].push({
      'job_component': job_probability_score(token, job_idx)
    })
    if (TokenInterpret.no_white_space(token)) {
      decisions[i]['votes'].push({
        'address_component': 0.5
      })
    }
  })
  return decisions
}

function most_likely_class (token_decision_object_array) {
  return token_decision_object_array.map((entry) => {
    modified_entry = entry
    sums = {
      'job_component': 0.0,
      'name_component': 0.0,
      'address_component': 0.0,
      'predicate': 0.0,
      'ambiguous': 0.0
    }
    entry['votes'].forEach(function (vote) {
      entries = Object.entries(vote)
      k = entries[0][0]
      v = entries[0][1]
      sums[k] += v
    })
    modified_entry['sums'] = sums
    return modified_entry
  })
}

function winner_take_all (array_most_likely_classes) {
  return array_most_likely_classes.map((entry) => {
    modified_entry = entry
    modified_entry['winning_class'] = Object.entries(entry['sums']).reduce((acc, val) => {
      return (val[1] > acc[1]) ? val : acc
    })
    return modified_entry
  })
}

function recount_votes (token_decision_object) {
  modified_entry = token_decision_object
  sums = {
    'job_component': 0.0,
    'name_component': 0.0,
    'address_component': 0.0,
    'predicate': 0.0,
    'ambiguous': 0.0
  }
  token_decision_object['votes'].forEach(function (vote) {
    entries = Object.entries(vote)
    k = entries[0][0]
    v = entries[0][1]
    sums[k] += v
  })
  modified_entry['sums'] = sums
  modified_entry['winning_class'] = Object.entries(modified_entry['sums']).reduce((acc, val) => {
    return (val[1] > acc[1]) ? val : acc
  })
  return modified_entry
}

function debug_line (line) {
  return {
    'original_line': line,
    'tokenized': tokenize(line),
    'category_vote': category_vote(tokenize(line)),
    'most_likely_class': most_likely_class(category_vote(tokenize(line))),
    'semantic_tokenize': semantic_tokenize(line),
    'final_record': create_labeled_record(line)
  }
}

function semantic_tokenize (line) {
  return winner_take_all(most_likely_class(category_vote(tokenize(line))))
}

function create_labeled_record (line) {
  return consolidate_features(semantic_tokenize(line))
}

function previous_winning_class (decision_list, current_index) {
  if (current_index - 1 >= 0) {
    return decision_list[current_index - 1]['winning_class'][0]
  }
  return null
}

function modify_probability_of_subsequent (list_of_acceptable, vote, decisions, curr_index) {
  if (curr_index + 1 < decisions.length) {
    next_decision = decisions[curr_index + 1]
    if (next_decision['winning_class'] != Object.keys(vote)[0] && list_of_acceptable.includes(next_decision['winning_class'][0])) {
      decisions[curr_index + 1].votes.push(vote)
      decisions[curr_index + 1] = recount_votes(decisions[curr_index + 1])
      return [decisions[curr_index + 1], curr_index]
    } else {
      return modify_probability_of_subsequent(list_of_acceptable, vote, decisions, curr_index + 1)
    }
  }
  return false
}

function subsequent_is_not_confident (decision_list, current_index) {
  if (current_index + 1 < decision_list.length) {
    next_decision = decision_list[current_index + 1]
    if (next_decision['winning_class'][1] < 1.0) {
      return next_decision['winning_class'][0]
    }
  }
  return null
}

/* Returns a record with labeled attributes */
function consolidate_features (all_decisions) {
  record = {
    'subject': [],
    'location': []
  }
  all_decisions.forEach((token, index) => {
    parsed_class = token['winning_class'][0]
    token_value = token['token']
    /* token_value = token['token']
    if (index == 0 && parsed_class == 'name_component') {

    } else { */
    switch (parsed_class) {
      case 'name_component':
        mr = merge_if_directly_subsequent_is_alike(all_decisions, index, token['winning_class'][0])
        if (mr) {
          all_decisions[index + 1] = mr
        } else {
          record['subject'].push({
            'value': token_value,
            'type': 'primary'
          })
        }
        break
      case 'job_component':
        if (!record['subject'].length == 0) {
          record['subject'][0]['occupation'] = token_value
        }
        break
      case 'predicate':
        switch (token_value) {
          case 'wid':
            if (!record['subject'].length == 0) {
              record['subject'][0]['occupation'] = 'widow'
            }
            deceased_name = look_for_name_of_deceased(all_decisions, index)
            if (deceased_name) {
              record['subject'].push({
                'value': deceased_name,
                'type': 'deceased spouse of primary'
              })
            }
            break
          case 'h':
            modify_probability_of_subsequent(['job_component', 'name_component'], {
              'address_component': 1.0
            }, all_decisions, index)
            attach_to_next(all_decisions, index, 'address_component', [{
              'type': 'home'
            }])
            break
          case 'r':
            modify_probability_of_subsequent(['job_component', 'name_component'], {
              'address_component': 1.0
            }, all_decisions, index)
            attach_to_next(all_decisions, index, 'address_component', [{
              'position': 'rear'
            }])
            break
          default:
            // Now we want to see if the predicate is actually a part of a
            // name –– e.g. 'A' is part of the name 'SMITH JOHN A'

            // check if last token was parsed as a name; if so, add it to the name
            if (all_decisions[index - 1]) {
              if (all_decisions[index - 1]['winning_class'][0] == 'name_component') {
                if (record['subject'][0]) {
                  record['subject'][0]['value'] = record['subject'][0]['value'] + ' ' + token_value
                }
              } else if (TokenInterpret.matches_cardinal_dir(token_value)) {
                console.log('treating as address: ' + token_value)
                treat_token_as_address_component(token, all_decisions, index, record)
              }
            }
            break

        }
        break
      case 'address_component':
        treat_token_as_address_component(token, all_decisions, index, record)
        break
    }
  })
  return record
}

function treat_token_as_address_component (parsed_token, all_decisions, current_index, record) {
  /* We check the confidence of the next token too,
    and may merge it into the address as well */
  subsequent_class = subsequent_is_not_confident(all_decisions, current_index)
  if (subsequent_class == 'job_component') {
    all_decisions[current_index + 1]['winning_class'] = ['address_component', 1.0]
  }
  loc = {
    'value': parsed_token['token']
  }
  if (parsed_token['additional']) {
    parsed_token['additional'].forEach((obj) => {
      pair = Object.entries(obj)[0]
      k = pair[0]
      v = pair[1]
      loc[k] = v
    })
  }
  mr = merge_if_directly_subsequent_is_alike(all_decisions, current_index, 'address_component')
  if (mr) {
    all_decisions[current_index + 1] = mr
  } else {
    record['location'].push(loc)
  }
}

function merge_if_directly_subsequent_is_alike (decision_list, current_index, current_token_class) {
  if (current_index + 1 < decision_list.length) {
    next_decision = decision_list[current_index + 1]
    if (next_decision['winning_class'][0] == current_token_class) {
      next_decision['token'] = decision_list[current_index]['token'] + ' ' + next_decision['token']
      if (decision_list[current_index]['additional']) {
        if (next_decision['additional']) {
          next_decision['additional'].concat(decision_list[current_index]['additional'])
        } else {
          next_decision['additional'] = decision_list[current_index]['additional']
        }
      }
      return next_decision
    }
  }
  return false
}

function attach_to_next (class_list, current_index, match_class, attributes) {
  if (current_index + 1 < class_list.length) {
    next_class = class_list[current_index + 1]
    if (next_class['winning_class'][0] == match_class) {
      attributes.forEach((att) => {
        if (next_class['additional']) {
          next_class['additional'].push(att)
        } else {
          next_class['additional'] = [att]
        }
      })
    } else {
      attach_to_next(class_list, current_index + 1, match_class, attributes)
    }
  }
}

function look_for_name_of_deceased (list_of_classes, current_index) {
  if (current_index + 1 < list_of_classes.length) {
    next_class = list_of_classes[current_index + 1]
    if (next_class['winning_class'][0] == 'name_component' || next_class['winning_class'][1] <= 0.5) {
      // we check if the next class is either a name_component, or had a low confidence
      next_class['winning_class'][0] = 'already_considered'
      return next_class['token']
    }
  }
}

// Exported functions and command line interface
module.exports = create_labeled_record

if (require.main === module) {
  process.argv.slice(2).forEach((input) => {
    console.log(`Input:\n  "${input}"`)

    const output = create_labeled_record(input)
    const outputStr = JSON.stringify(output, null, 2)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')

    console.log(`Output:\n${outputStr}`)
  })
}
