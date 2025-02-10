# eslint-plugin-use-effect-no-deps

Warns a user when the react hook useEffect is called with no dependency array.

My team found that we rarely needed the behavior of useEffect without a dependency array as the second argument. Among the 60 usages of useEffect in our codebase, none needed the effect to run on every render of the component. This rule makes an author ensure that the behavior of useEffect with one argument is what they intended.

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-use-effect-no-deps`:

```
$ npm install eslint-plugin-use-effect-no-deps --save-dev
```

**Note:** If you installed ESLint globally (using the `-g` flag) then you must also install `eslint-plugin-use-effect-no-deps` globally.

## Usage

Add `use-effect-no-deps` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "use-effect-no-deps"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "use-effect-no-deps/use-effect-no-deps": "warn"
    }
}
```

## Supported Rules

* use-effect-no-deps

## Attributions

The code for this rule is based on the exhaustive-deps rule that Facebook publishes under the MIT License. You can find
the source code for that rule here: https://github.com/facebook/react/blob/master/packages/eslint-plugin-react-hooks/src/ExhaustiveDeps.js





