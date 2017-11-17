# city-directory-entry-parser

city-directory-entry-parser parses lines from OCR’d [New York City directories](https://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=city+directories) into separate fields, such as names, occupations, and addresses.

city-directory-entry-parser is part of NYPL’s [NYC Space/Time Directory](http://spacetime.nypl.org) project.

For more tools that are used to turn digitized city directories into datasets, see Space/Time’s [City Directories repository](https://github.com/nypl-spacetime/city-directories).

This module relies on the [sklearn-crfsuite](https://sklearn-crfsuite.readthedocs.io/en/latest/) implementation of a conditional random fields algorithm.

## Example

![](example.jpg)

Input:

    "Calder William W, clerk, 206 W. 24th"

Output:

```json
{
  "subjects": [
    "Calder William W"
  ],
  "occupations": [
    "clerk"
  ],
  "addresses": [
    [
      "206 W . 24th"
    ]
  ]
}
```

If the output contains an `address` field, [nyc-street-normalizer](https://github.com/nypl-spacetime/nyc-street-normalizer) can be used to turn this abbreviated address into a full address (e.g. `668 Sixth av.` ⟶ `668 Sixth Avenue`).

## Installation & usage

From Python:

```python
from cdparser import Classifier, Features, LabeledEntry, Utils

## Create a classifier object and load some labeled data from a CSV
classifier = Classifier.Classifier()
classifier.load_training("/full/path/to/training/nypl-labeled-train.csv")

## Optionally, load validation dataset
classifier.load_validation("/full/path/to/validation/nypl-labeled-validate.csv")

## Train your classifier (with default settings)
classifier.train()

## Create an entry object from string
entry = LabeledEntry.LabeledEntry("Cappelmann Otto, grocer, 133 VVashxngton, & liquors, 170 Greenwich, h. 109 Cedar")

## Pass the entry to the classifier
classifier.label(entry)

## Export the labeled entry as JSON
json.dumps(entry.categories)
```

From bash (using `parse.py`):
```bash
cat /path/to/nypl-1851-1852-entries-sample.txt | python3 parse.py --training /path/to/nypl-labeled-70-training.csv
```


## See also

  - [NYC Space/Time Directory](http://spacetime.nypl.org)
  - [hocr-detect-columns](https://github.com/nypl-spacetime/hocr-detect-columns)
  - [nyc-street-normalizer](https://github.com/nypl-spacetime/nyc-street-normalizer)
  - [Extracting Structured Data From Recipes Using Conditional Random Fields - New York Times](https://open.blogs.nytimes.com/2015/04/09/extracting-structured-data-from-recipes-using-conditional-random-fields)
