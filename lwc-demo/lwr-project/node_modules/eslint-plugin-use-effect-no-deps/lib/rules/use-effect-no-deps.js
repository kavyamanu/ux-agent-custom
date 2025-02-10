/**
 * @fileoverview Warns a user when they call the react useEffect hook without a dependency array
 * @author Alex Henry
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description:
        "Warns a user when they call the react useEffect hook without a dependency array",
      category: "Possible errors",
      recommended: false
    },
    fixable: null,
    type: "suggestion"
  },

  create: function(context) {
    function getNodeWithoutReactNamespace(node) {
      if (
        node.type === "MemberExpression" &&
        node.object.type === "Identifier" &&
        node.object.name === "React" &&
        node.property.type === "Identifier" &&
        !node.computed
      ) {
        return node.property;
      }
      return node;
    }

    /**
     * Visitor for both function expressions and arrow function expressions.
     */
    function visitFunctionExpression(node) {
      // We only want to lint nodes which are reactive hook callbacks.
      if (
        (node.type !== "FunctionExpression" &&
          node.type !== "ArrowFunctionExpression") ||
        node.parent.type !== "CallExpression"
      ) {
        return;
      }

      if (node.parent.arguments[0] !== node) {
        return;
      }

      // Get the reactive hook node.
      const reactiveHook = node.parent.callee;
      const reactiveHookName = getNodeWithoutReactNamespace(reactiveHook).name;
      if (reactiveHookName !== "useEffect") {
        return;
      }

      // Get the declared dependencies for this reactive hook. If there is no
      // second argument then the useEffect callback will re-run on every render.
      // In this case, we want to warn the user they may be making a mistake.
      const declaredDependenciesNode = node.parent.arguments[1];
      if (!declaredDependenciesNode) {
        context.report({
          node: node.parent.callee,
          message:
            "useEffect re-runs on every render when called with one argument. Did you forget to pass a dependencies array?"
        });
      }
    }

    return {
      FunctionExpression: visitFunctionExpression,
      ArrowFunctionExpression: visitFunctionExpression
    };
  }
};
