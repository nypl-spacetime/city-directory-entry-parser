# city-directory-entry-parser

city-directory-entry-parser parses lines from OCR’d [New York City directories](https://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=city+directories) into separate fields, such as names, occupations, and addresses.

city-directory-entry-parser is part of NYPL’s [NYC Space/Time Directory](http://spacetime.nypl.org) project.

For more tools that are used to turn digitized city directories into datasets, see Space/Time’s [City Directories repository](https://github.com/nypl-spacetime/city-directories).

## Example

![](example.jpg)

Input:

    "Bebee Samuel, carpenter, h 668 Sixth av."

Output:

```json
{
  "subject": [
    {
      "value": "Bebee Samuel",
      "type": "primary",
      "occupation": "carpenter"
    }
  ],
  "location": [
    {
      "value": "668 Sixth av.",
      "type": "home"
    }
  ]
}
```

If the output contains a `location` field with a street address, [nyc-street-normalizer](https://github.com/nypl-spacetime/nyc-street-normalizer) can be used to turn this abbreviated address into a full address (e.g. `668 Sixth av.` ⟶ `668 Sixth Avenue`).

## Installation & usage

From Python:

```python
from cdparser import Classifier, Features, LabeledEntry, Utils

classifier = Classifier.Classifier()
classifier.load_training("/full/path/to/training/nypl-labeled-train.csv")

## Optionally, load validation dataset
classifier.load_validation("/full/path/to/validation/nypl-labeled-validate.csv")
classifier.train()

## Create an entry object from string
entry = LabeledEntry.LabeledEntry("Cappelmann Otto, grocer, 133 VVashxngton, & liquors, 170 Greenwich, h. 109 Cedar")

## Pass the entry to the classifier
classifier.label(entry)

## Export the labeled entry as JSON
json.dumps(entry.categories)
```


## See also

  - [NYC Space/Time Directory](http://spacetime.nypl.org)
  - [hocr-detect-columns](https://github.com/nypl-spacetime/hocr-detect-columns)
  - [nyc-street-normalizer](https://github.com/nypl-spacetime/nyc-street-normalizer)
