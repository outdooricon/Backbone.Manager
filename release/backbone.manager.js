(function(Backbone, _, $, window) {
  var Manager, cachedParamMatcher, cachedPathSegmentMatcher, managerQueue, onloadUrl, _watchForStateChange;
  managerQueue = _.extend({}, Backbone.Events);
  onloadUrl = window.location.href;
  cachedParamMatcher = /\:([^:)/]+)/g;
  cachedPathSegmentMatcher = /([^/]+)/g;
  Manager = (function() {
    Manager.prototype.states = {};

    Manager.prototype.events = {};

    function Manager(router, options) {
      this.router = router;
      _.extend(this, Backbone.Events);
      this._parseStates();
      this._parseEvents();
      this.initialize(options);
      return;
    }

    Manager.prototype.initialize = function() {};

    Manager.prototype._parseStates = function() {
      _.each(_.keys(this.states), (function(_this) {
        return function(stateKey) {
          var matches, stateOptions;
          stateOptions = _this.states[stateKey];
          if (!stateOptions.transitionMethod) {
            throw new Error(stateKey + ' needs transitionMethod definitions');
          }
          if (stateOptions.url) {
            if (_.isRegExp(stateOptions.url)) {
              throw new Error(stateKey + ' is not allowed to have a RegExp url');
            }
            stateOptions._urlParams = (function() {
              var _results;
              _results = [];
              while (matches = cachedParamMatcher.exec(stateOptions.url)) {
                _results.push(matches[1]);
              }
              return _results;
            })();
            stateOptions._urlAsTemplate = _.template(stateOptions.url, null, {
              interpolate: cachedParamMatcher
            });
            stateOptions._urlAsRegex = _this.router._routeToRegExp(stateOptions.url);
            _this.router.route(stateOptions._urlAsRegex, stateKey, function() {
              _this._routeCallbackChooser(stateKey, stateOptions, arguments);
            });
          }
          return _this.listenTo(managerQueue, stateKey, function(args) {
            _this._handleTransitionCallback(stateKey, stateOptions, args);
          });
        };
      })(this));
    };

    Manager.prototype._routeCallbackChooser = function(stateKey, stateOptions, clearOnloadUrl) {
      var historyHasUpdated;
      if (clearOnloadUrl == null) {
        clearOnloadUrl = true;
      }
      if (onloadUrl && this._getWindowHref() === onloadUrl) {
        this._handleLoadCallback(stateKey, stateOptions, arguments);
      } else {
        this._handleTransitionCallback(stateKey, stateOptions, arguments, historyHasUpdated = true);
      }
      if (clearOnloadUrl) {
        onloadUrl = null;
      }
    };

    Manager.prototype._handleLoadCallback = function(stateKey, stateOptions, args) {
      if (!stateOptions.loadMethod) {
        throw new Error(stateKey + ' is being triggered for load, but no loadMethod has been defined');
      }
      this.trigger('pre-load');
      this.trigger('pre-load:' + stateKey, args);
      this[stateOptions.loadMethod].apply(this, args);
      this.trigger('post-load:' + stateKey, args);
      this.trigger('post-load');
    };

    Manager.prototype._handleTransitionCallback = function(stateKey, stateOptions, args, historyHasUpdated) {
      var argsObject, data, options, url;
      if (historyHasUpdated == null) {
        historyHasUpdated = false;
      }
      this.trigger('pre-transition');
      this.trigger('pre-transition:' + stateKey);
      if (stateOptions.url) {
        if (args instanceof Array) {
          argsObject = _.object(stateOptions._urlParams, args);
          url = stateOptions._urlAsTemplate(argsObject);
          if (!historyHasUpdated) {
            this.router.navigate(url);
          }
          data = _.map(args, String);
          data.push(null);
        } else if (args instanceof Object) {
          url = stateOptions._urlAsTemplate(args);
          if (!historyHasUpdated) {
            this.router.navigate(url);
          }
          data = this.router._extractParameters(stateOptions._urlAsRegex, url);
        } else {
          throw new Error('Args are only supported as an object or array if state.url is defined');
        }
        options = {
          url: url
        };
        data.push(options);
      } else {
        data = args;
      }
      this[stateOptions.transitionMethod].apply(this, data);
      this.trigger('post-transition:' + stateKey);
      this.trigger('post-transition');
    };

    Manager.prototype._parseEvents = function() {
      _.each(_.keys(this.events), (function(_this) {
        return function(eventName) {
          _this.on(eventName, _this[_this.events[eventName]]);
        };
      })(this));
    };

    Manager.prototype._getWindowHref = function() {
      return window != null ? window.location.href : void 0;
    };

    Manager.go = function(state, args) {
      return managerQueue.trigger(state, args);
    };

    Manager.extend = Backbone.Model.extend;

    Manager.config = {
      urlToStateParser: function(urlPath) {
        var matches, segments, stateObj;
        stateObj = {
          state: '',
          args: []
        };
        segments = (function() {
          var _results;
          _results = [];
          while (matches = cachedPathSegmentMatcher.exec(urlPath)) {
            _results.push(matches[1]);
          }
          return _results;
        })();
        _.each(segments, function(segment, i) {
          if (i % 2) {
            stateObj.args.push(segments[i]);
            stateObj.state += 'detail';
          } else {
            stateObj.state += segments[i];
          }
          if (i !== segments.length - 1) {
            return stateObj.state += '.';
          }
        });
        return stateObj;
      }
    };

    return Manager;

  })();
  Backbone.Manager = Manager;
  _watchForStateChange = function(event) {
    var args, parsed, state, stateAttr, stateInfo;
    if (!event.isDefaultPrevented()) {
      stateAttr = $(event.target).attr('x-bb-state');
      event.preventDefault();
      if (stateAttr === null) {
        parsed = Backbone.Manager.config.urlToStateParser(event.target.href.pathname);
        state = parsed.state;
        args = parsed.args;
      } else {
        stateInfo = stateAttr.split('(', 2);
        state = stateInfo[0];
        args = JSON.parse(stateInfo[1].slice(0, stateInfo[1].indexOf(')')));
      }
      managerQueue.trigger(state, args);
    }
  };
  $('document').on('click', 'a[x-bb-state]', function(event) {
    return _watchForStateChange(event);
  });
;
})(Backbone, _, $, window);