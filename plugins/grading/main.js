var templates = [
    "root/externallib/text!root/plugins/grading/grading_page.html"

];

define(templates,function (gradingPageTpl) {
    var plugin = {
        settings: {
            name: "grading",
            type: "mod",
			component: "mod_grading",
            lang: {
                component: "core"
            }
        },

        routes: [
            ["grading/participants/:courseid/:moduleid", "grading", "viewActivities"],
			["grading/participants/:courseid/:moduleid/:userid", "grading", "viewActivities"],
			["grading/module/user/:courseid/:moduleid/:userid", "grading", "loadGradingPage"],
        ],


		isPluginVisible: function() {
            // Check core services.
			
			// A COMPLETER PLUS TARD AVEC LES WS UTILISES
			
            return true;

		},

        viewActivities: function(courseId, moduleId, userId) {
			userId = userId || -1;

            MM.panels.showLoading('center');

			    var params = {
				coursecapabilities:
					[{
						courseid:courseId,
						capabilities:['moodle/grade:viewall']
					}],
					
				options:
					[{
						name: "userfields",
						value: "id"
					}]
				};

             
				if(MM.util.wsAvailable('core_enrol_get_enrolled_users_with_capability')){
					//check permissions to see grading.
						
					MM.moodleWSCall('core_enrol_get_enrolled_users_with_capability', params, function(dat){
					
						var canSeeAllGrades = false;
						for (var i=0 ; i<dat[0].users.length ; i++) {								
							if(MM.config.current_site.userid == dat[0].users[i].id)
								canSeeAllGrades = true;
								
						}
												
						if(canSeeAllGrades){
							//allowed access
							
							MM.plugins.grading.showParticipants(courseId,moduleId,userId);
							
						}
						
						else						
							//no permissions
							
							MM.plugins.grading.loadGradingPage(courseId, moduleId, MM.config.current_site.userid);			
							
							
						},{},
						
						// Error callback, when no permissions
						function(e) {
							
							aleert('no accsee');
						}
					
					);
				
				}else 
					//if WS not available
					
					MM.plugins.grading.loadGradingPage(courseId, moduleId, MM.config.current_site.userid);

        },


        loadGradingPage: function(courseId, moduleId, userId) {
			
			var popUp = MM.deviceType == "phone";
		
			MM.plugins.grading.viewAssign(courseId, moduleId, userId);
			/*
			var tpl = {
				courseid : courseId,
				moduleid : moduleId,
                userid   : userId,
				popUp	 : popUp
			};
			
			var html = MM.tpl.render(MM.plugins.grading.templates.gradingPage.html, tpl);

			// Display as popup in the right side (from participants page).

				MM.panels.show('right', html, {title: "Devoir"});
*/
                
        },
		
		showParticipants: function(courseId, moduleId, userId) {

            MM.panels.showLoading('center');

            if (MM.deviceType == "tablet") {
                MM.panels.showLoading('right');
            }


            MM.plugins.participants._loadParticipants(courseId, 0, MM.plugins.participants.limitNumber,
                function(users) {
                    // Removing loading icon.
                    $('a[href="#participants/' +courseId+ '"]').removeClass('loading-row');

                    var showMore = true;
                    if (users.length < MM.plugins.participants.limitNumber) {
                        showMore = false;
                    }

                    MM.plugins.participants.nextLimitFrom = MM.plugins.participants.limitNumber;

                    var tpl = {
                        users: users,
                        deviceType: MM.deviceType,
                        courseId: courseId,
						moduleId: moduleId,
						userId: userId,
                        showMore: showMore,

                    };

					var html = MM.tpl.render(MM.plugins.participants.templates.participants.html, tpl);
						
                    var course = MM.db.get("courses", MM.config.current_site.id + "-" + courseId);
                    var pageTitle = "";

                    if (course) {
                        pageTitle = course.get("shortname");;
                    }

                    MM.panels.show('center', "<a href='#course/contents/"+courseId+"'><img src='img/arrowleft.png'></a>"+html, {title: pageTitle});
					

					
                    // Load the first user
					if(userId != -1){
						MM.plugins.grading.loadGradingPage(courseId, moduleId, userId,1,1);
						$("#panel-center #user-"+userId).addClass("selected-row");
					}
                    else if (MM.deviceType == "tablet" && users.length > 0) {
							$("#panel-center li:eq(0)").addClass("selected-row");
							MM.plugins.grading.loadGradingPage(courseId, moduleId, users.shift().id,1,1);
							$("#panel-center li:eq(0)").addClass("selected-row");
						}

                    

                    // Save the users in the users table.
                    var newUser;
                    users.forEach(function(user) {
                        newUser = {
                            'id': MM.config.current_site.id + '-' + user.id,
                            'userid': user.id,
                            'fullname': user.fullname,
                            'profileimageurl': user.profileimageurl
                        };
                        MM.db.insert('users', newUser);
                    });

                    // Show more button.
                    $("#participants-showmore").on(MM.clickType, function(e) {
                        var that = $(this);
                        $(this).addClass("loading-row-black");

                        MM.plugins.participants._loadParticipants(
                            courseId,
                            MM.plugins.participants.nextLimitFrom,
                            MM.plugins.participants.limitNumber,
                            function(users) {
                                that.removeClass("loading-row-black");
                                MM.plugins.participants.nextLimitFrom += MM.plugins.participants.limitNumber;

                                var tpl = {courseId: courseId, users: users, moduleId: moduleId, userId: userId};
								var newUsers;
									newUsers = MM.tpl.render(MM.plugins.participants.templates.participantsRow.html, tpl);
                                $("#participants-additional").append(newUsers);
                                if (users.length < MM.plugins.participants.limitNumber) {
                                    that.css("display", "none");
                                }
                            },
                            function() {
                                that.removeClass("loading-row-black");
                            }
                        );
						

						
                    });

                }, function(m) {
                    // Removing loading icon.
                    $('a[href="#participants/' +courseId+ '"]').removeClass('loading-row');
                    if (typeof(m) !== "undefined" && m) {
                        MM.popErrorMessage(m);
                    }
				}
                
            );
        },
		
		viewAssign: function(courseId, cmid, userId) {
            // Loading ....
            $("#info-" + cmid, "#panel-right").attr("src", "img/loadingblack.gif");

            // First, load the complete information of assigns in this course.
            var params = {
                "courseids[0]": courseId
            };

            MM.moodleWSCall("mod_assign_get_assignments",
                params,
                function(result) {
                    var course = result.courses.shift();
                    var currentAssign;
                    _.each(course.assignments, function(assign) {
                        if (assign.cmid == cmid) {
                            currentAssign = assign;
                        }
                    });
                    if (currentAssign) {
                        MM.plugins.grading._showSubmissions(currentAssign, userId);
                    }
                },
                null,
                function (error) {
                    $("#info-" + cmid, "#panel-right").attr("src", "img/info.png");
                    MM.popErrorMessage(error);
                }
            );
        },

        /**
         * Display submissions of a assign
         * @param  {Object} assign assign object
         *
         */
        _showSubmissions: function(assign, userId) {

            var params = {
                "assignmentids[0]": assign.id
            };

            MM.moodleWSCall("mod_assign_get_submissions",
                params,
                // Success callback.
                function(result) {
                    // Stops loading...
                    $("#info-" + assign.cmid, "#panel-right").attr("src", "img/info.png");
                    var siteId = MM.config.current_site.id;

                    var sectionName = "";
                    if (MM.plugins.assign.sectionsCache[assign.cmid]) {
                        sectionName = MM.plugins.assign.sectionsCache[assign.cmid];
                    }

                    var pageTitle = '<div id="back-arrow-title" class="media">\
                            <div class="img app-ico">\
                                <img src="img/mod/assign.png" alt="img">\
                            </div>\
                            <div class="bd">\
                                <h2>' + MM.util.formatText(assign.name) + '</h2>\
                            </div>\
                        </div>';

					var device;          
					if (MM.deviceType == "phone") {
						device = "phone";
					}
					
                    var data = {
                        "assign": assign,
                        "sectionName": sectionName,
                        "activityLink": MM.config.current_site.siteurl + '/mod/assign/view.php?id=' + assign.cmid,
                        "submissions": [],
						"device": device,
                        "user": ''
                    };

                    // Check if we can view submissions, with enought permissions.
                    if (result.warnings.length > 0 && result.warnings[0].warningcode == 1) {
                        data.canviewsubmissions = false;
                    } else {
                        data.canviewsubmissions = true;
                        data.submissions = result.assignments[0].submissions;
                    }

                    // Handle attachments.
                    for (var el in assign.introattachments) {
                        var attachment = assign.introattachments[el];

                        assign.introattachments[el].id = assign.id + "-intro-" + el;

                        var uniqueId = MM.config.current_site.id + "-" + hex_md5(attachment.fileurl);
                        var path = MM.db.get("assign_files", uniqueId);
                        if (path) {
                            assign.introattachments[el].localpath = path.get("localpath");
                        }

                        var extension = MM.util.getFileExtension(attachment.filename);
                        if (typeof(MM.plugins.contents.templates.mimetypes[extension]) != "undefined") {
                            assign.introattachments[el].icon = MM.plugins.contents.templates.mimetypes[extension]["icon"] + "-64.png";
                        }
                    }

                    // Render the page if the user is likely an student.
                    if (! data.canviewsubmissions) {
                        MM.plugins.grading._renderSubmissionsPage(data, pageTitle);
                    } else {
                        // In this case, we would need additional information (like pre-fetching the course participants).

						var params = {
						'userids[0]': userId };

						
						MM.moodleWSCall('moodle_user_get_users_by_id', params, function(user) {

										
							newUser = {
								'id': MM.config.current_site.id + '-' + user[0].id,
								'userid': user[0].id,
								'fullname': user[0].fullname,
								'profileimageurl': user[0].profileimageurl
							};

								data.user = newUser;
										
						
							// Render the submissions page.
							MM.plugins.grading._renderSubmissionsPage(data, pageTitle);
						}, null, function(m) {
							MM.popErrorMessage(m);
						});

                    }
                },
                null,
                function (error) {
                    $("#info-" + assign.cmid, "#panel-right").attr("src", "img/info.png");
                    MM.popErrorMessage(error);
                }
            );
        },


        _renderSubmissionsPage: function(data, pageTitle) {

            MM.plugins.assign.submissionsCache = data.submissions;

            var html = MM.tpl.render(MM.plugins.grading.templates.gradingPage.html, data);
            MM.panels.show("right", html, {title: pageTitle});
						
			
            // Handle intro files downloads.
            $(".assign-download", "#panel-right").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();

                var url = $(this).data("downloadurl");
                var filename = $(this).data("filename");
                var attachmentId = $(this).data("attachmentid");

                MM.plugins.assign._downloadFile(url, filename, attachmentId,true);
            });

            // View submission texts.
            $(".submissiontext", "#panel-right").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();

                var submissionid = $(this).data("submissionid");
                var submission = {};
                data.submissions.forEach(function(s) {
                    if (s.id == submissionid) {
                        submission = s;
                    }
                })
                var text = MM.plugins.assign._getSubmissionText(submission);
                MM.widgets.renderIframeModalContents(pageTitle, text);

            });
        },
		
        templates: {
            "gradingPage": {
                html: gradingPageTpl
            }
        }
    };

    MM.registerPlugin(plugin);
});