angular.module('app')
	.controller('indexController', function( $window, $location, $scope, $http) {
		$scope.loading = false;
		$scope.submit = function() {
			$scope.loading = true;
			$http.post(WEB_ROOT + '/build', $scope.table.items[$scope.selectIndex])
				.success(function(data) {
					$scope.loading = false;
					$window.location.href = WEB_ROOT + "/downloads/" + data;
				})
				.error(function() {
					console.log("An error occurred :/");	
				});
			
		}
		$scope.auth = function() {
			$http.get(WEB_ROOT + '/fusiontable')
				.success(function(data) {
					$window.location.href = data;
				});
		}
		$scope.moveDown = function(ind) {
			var columnsArr = $scope.table.items[$scope.selectIndex].columns;
			if(ind < columnsArr.length-1) {
				var temp = columnsArr[ind+1];
				columnsArr[ind+1] = columnsArr[ind];
				columnsArr[ind] = temp;
			}
		}
		$scope.moveUp = function(ind) {
			var columnsArr = $scope.table.items[$scope.selectIndex].columns;
			if(ind > 0) {
				var temp = columnsArr[ind-1];
				columnsArr[ind-1] = columnsArr[ind];
				columnsArr[ind] = temp;
			}
		}
		$scope.table = {};
		$scope.selectIndex = "";
		$scope.writeProp = function(ind, key, value) {
			var selTable = $scope.table.items[$scope.selectIndex];
			var col = selTable.columns[ind];
			col[key] = value;
		}
		$scope.notSel = function(field) {
			var selTable = $scope.table.items[$scope.selectIndex];
			if(selTable.id !== field.name) {
				return false;
			}
			else {
				field.inputType = 'unused';
				return true;
			}
		}

		$http.get(WEB_ROOT + '/fusiontable/table')
			.success(function(data) {
				$scope.table = data;
				if($scope.table === 'NOT LOGGED IN') {
					$scope.auth();
				}
			});
	});	
