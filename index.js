const path = require('path')
const R = require('ramda')
const lunr = require('lunr')

// Create occupations index using lunr
const occupations = require(path.join(__dirname, 'data', 'consolidated-occupations.json'))
const occupationIndex = lunr(function () {
  this.ref('id')
  this.field('value')

  occupations.forEach(function (doc) {
    this.add(doc)
  }, this)
})

function occupationProbabilityScore (token, index) {
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
  const token1 = line.split(/(,|\.\s)/).map(R.trim)
  const token2 = token1.filter((elem) => !(/^\s*[,\.]\s*$/.test(elem)))

  t3 = []
  token2.forEach(function (token) {
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

  orderedTokens.forEach((token, index) => {
    if (TokenInterpret.isShort(token)) {
      decisions[index].votes.push({
        predicate: 1.9
      })
    }

    if (TokenInterpret.isKnownPredicate(token)) {
      decisions[index].votes.push({
        predicate: 1.9
      })
    }

    if (TokenInterpret.containsNumbers(token)) {
      decisions[index].votes.push({
        addressComponent: 2
      })
    }

    if (index === 0) {
      decisions[index].votes.push({
        nameComponent: 1
      })

      if (!TokenInterpret.containsNumbers(token)) {
        decisions[index].votes.push({
          nameComponent: 1
        })
      }
    }

    // End first token
    if (token.length > 2 && TokenInterpret.percentUppercase(token) > 0.5) {
      decisions[index].votes.push({
        nameComponent: 2.0
      })
    }

    decisions[index].votes.push({
      occupationComponent: occupationProbabilityScore(token, occupationIndex)
    })

    if (TokenInterpret.noWhiteSpace(token)) {
      decisions[index].votes.push({
        addressComponent: 0.5
      })
    }
  })

  return decisions
}

function mostLikelyClass (token_decision_object_array) {
  return token_decision_object_array.map((entry) => {
    modified_entry = entry
    sums = {
      'occupationComponent': 0.0,
      'nameComponent': 0.0,
      'addressComponent': 0.0,
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

function winnerTakeAll (array_mostLikelyClasses) {
  return array_mostLikelyClasses.map((entry) => {
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
    'occupationComponent': 0.0,
    'nameComponent': 0.0,
    'addressComponent': 0.0,
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
  return consolidateFeatures(
    winnerTakeAll(
      mostLikelyClass(
        categoryVote(
          tokenize(line)
        )
      )
    )
  )
}

function modifyProbabilityOfSubsequent (acceptable, vote, decisions, currentIndex) {
  if (currentIndex + 1 < decisions.length) {
    nextDecision = decisions[currentIndex + 1]
    if (nextDecision.winningClass != Object.keys(vote)[0] && acceptable.includes(nextDecision.winningClass[0])) {
      decisions[currentIndex + 1].votes.push(vote)
      decisions[currentIndex + 1] = recount_votes(decisions[currentIndex + 1])
      return [decisions[currentIndex + 1], currentIndex]
    } else {
      return modifyProbabilityOfSubsequent(acceptable, vote, decisions, currentIndex + 1)
    }
  }
}

function subsequentIsNotConfident (decisions, currentIndex) {
  if (currentIndex + 1 < decisions.length) {
    nextDecision = decisions[currentIndex + 1]
    if (nextDecision.winningClass[1] < 1) {
      return nextDecision.winningClass[0]
    }
  }
}

// Returns a record with labeled attributes
function consolidateFeatures (allDecisions) {
  record = {
    'subject': [],
    'location': []
  }
  allDecisions.forEach((token, index) => {
    parsedClass = token.winningClass[0]
    tokenValue = token.token

    switch (parsedClass) {
      case 'nameComponent':
        mr = mergeIfDirectlySubsequentIsAlike(allDecisions, index, token.winningClass[0])
        if (mr) {
          allDecisions[index + 1] = mr
        } else {
          record.subject.push({
            value: tokenValue,
            type: 'primary'
          })
        }
        break
      case 'occupationComponent':
        if (!record.subject.length == 0) {
          record.subject[0].occupation = tokenValue
        }
        break
      case 'predicate':
        switch (tokenValue) {
          case 'wid':
            if (!record.subject.length == 0) {
              record.subject[0].occupation = 'widow'
            }
            deceased_name = lookForNameOfDeceased(allDecisions, index)
            if (deceased_name) {
              record.subject.push({
                value: deceased_name,
                type: 'deceased spouse of primary'
              })
            }
            break
          case 'h':
            modifyProbabilityOfSubsequent(['occupationComponent', 'nameComponent'], {
              'addressComponent': 1.0
            }, allDecisions, index)
            attachToNext(allDecisions, index, 'addressComponent', [{
              'type': 'home'
            }])
            break
          case 'r':
            modifyProbabilityOfSubsequent(['occupationComponent', 'nameComponent'], {
              'addressComponent': 1.0
            }, allDecisions, index)
            attachToNext(allDecisions, index, 'addressComponent', [{
              'position': 'rear'
            }])
            break
          default:
            // Now we want to see if the predicate is actually a part of a
            // name –– e.g. 'A' is part of the name 'SMITH JOHN A'

            // check if last token was parsed as a name; if so, add it to the name
            if (allDecisions[index - 1]) {
              if (allDecisions[index - 1]['winningClass'][0] == 'nameComponent') {
                if (record['subject'][0]) {
                  record['subject'][0]['value'] = record['subject'][0]['value'] + ' ' + tokenValue
                }
              } else if (TokenInterpret.matchesCardinalDir(tokenValue)) {
                console.log('treating as address: ' + tokenValue)
                treat_token_as_addressComponent(token, allDecisions, index, record)
              }
            }
            break

        }
        break
      case 'addressComponent':
        treat_token_as_addressComponent(token, allDecisions, index, record)
        break
    }
  })
  return record
}

function treat_token_as_addressComponent (parsedToken, allDecisions, currentIndex, record) {
  // We check the confidence of the next token too,
  //   and may merge it into the address as well
  subsequent_class = subsequentIsNotConfident(allDecisions, currentIndex)
  if (subsequent_class == 'occupationComponent') {
    allDecisions[currentIndex + 1].winningClass = ['addressComponent', 1.0]
  }

  const location = {
    value: parsedToken.token
  }

  if (parsedToken['additional']) {
    parsedToken['additional'].forEach((obj) => {
      pair = Object.entries(obj)[0]
      k = pair[0]
      v = pair[1]
      location[k] = v
    })
  }
  mr = mergeIfDirectlySubsequentIsAlike(allDecisions, currentIndex, 'addressComponent')
  if (mr) {
    allDecisions[currentIndex + 1] = mr
  } else {
    record['location'].push(location)
  }
}

function mergeIfDirectlySubsequentIsAlike (decisions, currentIndex, current_token_class) {
  if (currentIndex + 1 < decisions.length) {
    const nextDecision = decisions[currentIndex + 1]
    if (nextDecision['winningClass'][0] == current_token_class) {
      nextDecision['token'] = decisions[currentIndex]['token'] + ' ' + nextDecision['token']
      if (decisions[currentIndex]['additional']) {
        if (nextDecision['additional']) {
          nextDecision['additional'].concat(decisions[currentIndex]['additional'])
        } else {
          nextDecision['additional'] = decisions[currentIndex]['additional']
        }
      }
      return nextDecision
    }
  }
}

function attachToNext (classes, currentIndex, matchClass, attributes) {
  if (currentIndex + 1 < classes.length) {
    const nextClass = classes[currentIndex + 1]
    if (nextClass.winningClass[0] === matchClass) {
      attributes.forEach((attribute) => {
        if (nextClass.additional) {
          nextClass.additional.push(attribute)
        } else {
          nextClass.additional = [attribute]
        }
      })
    } else {
      attachToNext(classes, currentIndex + 1, matchClass, attributes)
    }
  }
}

function lookForNameOfDeceased (classes, currentIndex) {
  if (currentIndex + 1 < classes.length) {
    const nextClass = classes[currentIndex + 1]
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
