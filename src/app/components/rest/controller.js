angular.module('cerebro').controller('RestController', ['$scope', '$http',
  '$sce', 'RestDataService', 'AlertService', 'ModalService', 'AceEditorService',
  'ClipboardService',
  function($scope, $http, $sce, RestDataService, AlertService, ModalService,
      AceEditorService, ClipboardService) {
    $scope.editor = undefined;
    $scope.response = undefined;

    $scope.indices = undefined;
    $scope.host = undefined;

    $scope.method = 'GET';
    $scope.path = '';
    $scope.options = [];

    var success = function(response) {
      $scope.response = $sce.trustAsHtml(JSONTree.create(response));
      $scope.loadHistory();
    };

    var setWithExpiry = function(key, value, ttl) {
      var now = new Date();

      // `item` is an object which contains the original value
      // as well as the time when it's supposed to expire
      var item = {
        value: value,
        expiry: now.getTime() + ttl,
      };
      localStorage.setItem(key, JSON.stringify(item));
    };

    var getWithExpiry = function(key) {
      var itemStr = localStorage.getItem(key);
      // if the item doesn't exist, return null
      if (!itemStr) {
        return null;
      }
      var item = JSON.parse(itemStr);
      var now = new Date();
      // compare the expiry time of the item with the current time
      if (now.getTime() > item.expiry) {
        // If the item is expired, delete the item from storage
        // and return null
        localStorage.removeItem(key);
        return null;
      }
      return item.value;
    };

    $scope.deleteFromLocalStorage = function(key) {
      localStorage.removeItem(key);
      AlertService.info('Indices Cache Successfully Cleared');
    };

    var failure = function(response) {
      $scope.response = $sce.trustAsHtml(JSONTree.create(response));
    };

    $scope.execute = function() {
      var data = $scope.editor.getStringValue();
      var method = $scope.method;
      $scope.response = undefined;
      try {
        data = $scope.editor.getValue();
      } catch (error) {
      }
      RestDataService.execute(method, $scope.path, data, success, failure);
    };

    $scope.setup = function() {
      $scope.editor = AceEditorService.init('rest-client-editor');
      $scope.editor.setValue('{}');
      RestDataService.load(
          function(response) {
            $scope.host = response.host;
            $scope.indices = response.indices;
            $scope.updateOptions($scope.path);
          },
          function(error) {
            AlertService.error('Error while loading cluster indices', error);
          }
      );
      $scope.loadHistory();
    };

    $scope.loadRequest = function(request) {
      $scope.method = request.method;
      $scope.path = request.path;
      $scope.editor.setValue(request.body);
      $scope.editor.format();
    };

    $scope.loadHistory = function() {
      RestDataService.history(
          function(history) {
            $scope.history = history;
          },
          function(error) {
            AlertService.error('Error while loading request history', error);
          }
      );
    };

    $scope.updateOptions = function(text) {
      var indices = getWithExpiry('indices');
      if ($scope.indices && indices !== null) {
        $scope.options = indices;
      } else if ($scope.indices) {
        var autocomplete = new URLAutocomplete($scope.indices);
        $scope.options = autocomplete.getAlternatives(text);
        // Store Indices with a 1 Month TTL
        setWithExpiry('indices', $scope.options, 2629800000);
      }
    };

    $scope.copyAsCURLCommand = function() {
      var method = $scope.method;
      var path = encodeURI($scope.path);
      if (path.substring(0, 1) !== '/') {
        path = '/' + path;
      }

      var matchesAPI = function(path, api) {
        return path.indexOf(api) === (path.length - api.length);
      };

      var contentType = 'application/json';
      var body = '';

      try {
        if (matchesAPI(path, '_bulk') || matchesAPI(path, '_msearch')) {
          contentType = 'application/x-ndjson';
          body = $scope.editor.getStringValue().split('\n').map(function(line) {
            return line === '' ? '\n' : JSON.stringify(JSON.parse(line));
          }).join('\n');
        } else {
          body = JSON.stringify($scope.editor.getValue(), undefined, 1);
        }
      } catch (e) {
        AlertService.error('Unexpected content format for [' + path + ']');
        return;
      }

      var curl = 'curl';
      curl += ' -H \'Content-type: ' + contentType + '\'';
      curl += ' -X' + method + ' \'' + $scope.host + path + '\'';
      if (['POST', 'PUT'].indexOf(method) >= 0) {
        curl += ' -d \'' + body + '\'';
      }
      ClipboardService.copy(
          curl,
          function() {
            AlertService.info('cURL request successfully copied to clipboard');
          },
          function() {
            AlertService.error('Error while copying request to clipboard');
          }
      );
    };
  }]
);
