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
  static containsNumbers (token) {
    return /\d/.test(token)
  }

  static matchesCardinalDir (token) {
    return /^(s|S|w|W|e|E|n|N).{0,1}$/.test(token)
  }

  static noWhiteSpace (token) {
    return !/^\S*(\s)+\S*$/.test(token)
  }

  static isShort (token) {
    return (token.length < 2)
  }

  static couldBeAbbreviation (token, index) {
    return token.length === 1 && index > 0
  }

  static percentUppercase (token) {
    return token
      .replace(/ /g, '')
      .split('')
      .map((char) => char.toUpperCase() == char && isNaN(char))
      .reduce((acc, val) => acc + (!!val ? 1 : 0), 0) / token.replace(/ /g, '').length
  }

  static isKnownPredicate (token) {
    return /^(wid|h|r).?$/i.test(token)
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
    t3 = t3.concat(jitterSplit(token))
  })
  t3 = t3.filter((elem) => {
    return elem.length > 0
  })
  return t3
}

/* Split token into two if begins or ends with a single character */
function jitterSplit (token) {
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

function categoryVote (orderedTokens) {
  const decisions = orderedTokens.map((token, index) => ({
    token,
    index,
    votes: []
  }))

  orderedTokens.forEach(function (token, i) {
    if (TokenInterpret.isShort(token)) {
      decisions[i]['votes'].push({
        'predicate': 1.9
      })
    }
    if (TokenInterpret.isKnownPredicate(token)) {
      decisions[i]['votes'].push({
        'predicate': 1.9
      })
    }
    if (TokenInterpret.containsNumbers(token)) {
      decisions[i]['votes'].push({
        'address_component': 2.0
      })
    }
    if (i == 0) {
      decisions[i]['votes'].push({
        'nameComponent': 1.0
      })
      if (!TokenInterpret.containsNumbers(token)) {
        decisions[i]['votes'].push({
          'nameComponent': 1.0
        })
      }
    } // End first token
    if (token.length > 2 && TokenInterpret.percentUppercase(token) > 0.5) {
      decisions[i]['votes'].push({
        'nameComponent': 2.0
      })
    }
    decisions[i]['votes'].push({
      'job_component': job_probability_score(token, job_idx)
    })
    if (TokenInterpret.noWhiteSpace(token)) {
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
      'nameComponent': 0.0,
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
    modified_entry['winningClass'] = Object.entries(entry['sums']).reduce((acc, val) => {
      return (val[1] > acc[1]) ? val : acc
    })
    return modified_entry
  })
}

function recount_votes (token_decision_object) {
  modified_entry = token_decision_object
  sums = {
    'job_component': 0.0,
    'nameComponent': 0.0,
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
  modified_entry['winningClass'] = Object.entries(modified_entry['sums']).reduce((acc, val) => {
    return (val[1] > acc[1]) ? val : acc
  })
  return modified_entry
}

function createLabeledRecord (line) {
  return consolidate_features(
    winner_take_all(
      most_likely_class(
        categoryVote(
          tokenize(line)
        )
      )
    )
  )
}

function previous_winningClass (decision_list, currentIndex) {
  if (currentIndex - 1 >= 0) {
    return decision_list[currentIndex - 1]['winningClass'][0]
  }
}

function modify_probability_of_subsequent (list_of_acceptable, vote, decisions, curr_index) {
  if (curr_index + 1 < decisions.length) {
    next_decision = decisions[curr_index + 1]
    if (next_decision['winningClass'] != Object.keys(vote)[0] && list_of_acceptable.includes(next_decision['winningClass'][0])) {
      decisions[curr_index + 1].votes.push(vote)
      decisions[curr_index + 1] = recount_votes(decisions[curr_index + 1])
      return [decisions[curr_index + 1], curr_index]
    } else {
      return modify_probability_of_subsequent(list_of_acceptable, vote, decisions, curr_index + 1)
    }
  }
}

function subsequent_is_not_confident (decision_list, currentIndex) {
  if (currentIndex + 1 < decision_list.length) {
    next_decision = decision_list[currentIndex + 1]
    if (next_decision['winningClass'][1] < 1.0) {
      return next_decision['winningClass'][0]
    }
  }
}

/* Returns a record with labeled attributes */
function consolidate_features (all_decisions) {
  record = {
    'subject': [],
    'location': []
  }
  all_decisions.forEach((token, index) => {
    parsed_class = token['winningClass'][0]
    token_value = token['token']
    /* token_value = token['token']
    if (index == 0 && parsed_class == 'nameComponent') {

    } else { */
    switch (parsed_class) {
      case 'nameComponent':
        mr = merge_if_directly_subsequent_is_alike(all_decisions, index, token['winningClass'][0])
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
            deceased_name = lookForNameOfDeceased(all_decisions, index)
            if (deceased_name) {
              record['subject'].push({
                'value': deceased_name,
                'type': 'deceased spouse of primary'
              })
            }
            break
          case 'h':
            modify_probability_of_subsequent(['job_component', 'nameComponent'], {
              'address_component': 1.0
            }, all_decisions, index)
            attach_to_next(all_decisions, index, 'address_component', [{
              'type': 'home'
            }])
            break
          case 'r':
            modify_probability_of_subsequent(['job_component', 'nameComponent'], {
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
              if (all_decisions[index - 1]['winningClass'][0] == 'nameComponent') {
                if (record['subject'][0]) {
                  record['subject'][0]['value'] = record['subject'][0]['value'] + ' ' + token_value
                }
              } else if (TokenInterpret.matchesCardinalDir(token_value)) {
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

function treat_token_as_address_component (parsed_token, all_decisions, currentIndex, record) {
  /* We check the confidence of the next token too,
    and may merge it into the address as well */
  subsequent_class = subsequent_is_not_confident(all_decisions, currentIndex)
  if (subsequent_class == 'job_component') {
    all_decisions[currentIndex + 1]['winningClass'] = ['address_component', 1.0]
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
  mr = merge_if_directly_subsequent_is_alike(all_decisions, currentIndex, 'address_component')
  if (mr) {
    all_decisions[currentIndex + 1] = mr
  } else {
    record['location'].push(loc)
  }
}

function merge_if_directly_subsequent_is_alike (decision_list, currentIndex, current_token_class) {
  if (currentIndex + 1 < decision_list.length) {
    next_decision = decision_list[currentIndex + 1]
    if (next_decision['winningClass'][0] == current_token_class) {
      next_decision['token'] = decision_list[currentIndex]['token'] + ' ' + next_decision['token']
      if (decision_list[currentIndex]['additional']) {
        if (next_decision['additional']) {
          next_decision['additional'].concat(decision_list[currentIndex]['additional'])
        } else {
          next_decision['additional'] = decision_list[currentIndex]['additional']
        }
      }
      return next_decision
    }
  }
  return false
}

function attach_to_next (class_list, currentIndex, match_class, attributes) {
  if (currentIndex + 1 < class_list.length) {
    nextClass = class_list[currentIndex + 1]
    if (nextClass['winningClass'][0] == match_class) {
      attributes.forEach((att) => {
        if (nextClass['additional']) {
          nextClass['additional'].push(att)
        } else {
          nextClass['additional'] = [att]
        }
      })
    } else {
      attach_to_next(class_list, currentIndex + 1, match_class, attributes)
    }
  }
}

function lookForNameOfDeceased (classes, currentIndex) {
  if (currentIndex + 1 < classes.length) {
    nextClass = classes[currentIndex + 1]
    if (nextClass.winningClass[0] === 'nameComponent' || nextClass.winningClass[1] <= 0.5) {
      // we check if the next class is either a nameComponent, or had a low confidence
      nextClass.winningClass[0] = 'alreadyConsidered'
      return nextClass.token
    }
  }
}

// Exported functions and command line interface
module.exports = createLabeledRecord

if (require.main === module) {
  process.argv.slice(2).forEach((input) => {
    console.log(`Input:\n  "${input}"`)

    const output = createLabeledRecord(input)
    const outputStr = JSON.stringify(output, null, 2)
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')

    console.log(`Output:\n${outputStr}`)
  })
}
