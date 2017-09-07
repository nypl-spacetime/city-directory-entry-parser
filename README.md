# city-directory-entry-parser

city-directory-entry-parser parses lines from OCR'd [New York City directories](https://digitalcollections.nypl.org/search/index?utf8=%E2%9C%93&keywords=city+directories) into seperate fields, such as names, occupations, and addresses.

city-directory-entry-parser is part of NYPL’s [NYC Space/Time Directory](http://spacetime.nypl.org) project.

For more tools that are used to turn digitized city directories into datasets, see https://github.com/nypl-spacetime/city-directories.

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

## Installation & usage

From Node.js:

    npm install --save nypl-spacetime/city-directory-entry-parser

```js
const parser = require('@spacetime/city-directory-entry-parser')

console.log(parser('Pfeffer Conrad, cabinetmaker, h. 478 Twelfth'))
```

From the command line:

    npm install -g nypl-spacetime/city-directory-entry-parser

    city-directory-entry-parser "Pfeffer Conrad, cabinetmaker, h. 478 Twelfth"