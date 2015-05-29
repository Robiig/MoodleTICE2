var templates = [
    "root/externallib/text!root/plugins/grading/grading_page.html",
	"root/externallib/text!root/plugins/grading/grading_form.html"
];

define(templates,function (gradingPageTpl,gradingFormTpl) {
    var plugin = {
        settings: {
            name: "grading",
            type: "mod",
			component: "mod_grading",
            lang: {
                component: "core"
            }
        },
		
		storage: {
            "grading_info": {type: "model"},
            "grading_infos": {type: "collection", model: "grading_info"}
        },

        routes: [
            ["grading/participants/:courseid/:moduleid/:showallparticipants", "grading", "viewActivities"],
			["grading/participants/:courseid/:moduleid/:showallparticipants/:userid", "grading", "viewActivities"],
			["grading/module/user/:courseid/:moduleid/:userid", "grading", "viewAssign"],
        ],


        viewActivities: function(courseId, moduleId, showAllParticipant, userId) {
			userId = userId || -1;

           

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
							 MM.panels.showLoading('center');
							MM.plugins.grading.showParticipants(courseId,moduleId,showAllParticipant,userId);
							
						}
						
						else						
							//no permissions
							
							MM.plugins.grading.viewAssign(courseId, moduleId, MM.config.current_site.userid);			
							
							
						},{},
						
						// Error callback, when no permissions
						function(e) {
							
							MM.popErrorMessage(MM.lang.s("nopermissionstograding"));
							
						}
					
					);
				
				}else 
					//if WS not available
					
					MM.plugins.grading.viewAssign(courseId, moduleId, MM.config.current_site.userid);

        },


		
		//showAllParticipant: 1 show all the participants who follow the course.
							//0 show only participants who sent a submission
		showParticipants: function(courseId, moduleId, showAllParticipant, userId) { 

			
            MM.panels.showLoading('center');

            if (MM.deviceType == "tablet") {
                MM.panels.showLoading('right');
            }


            MM.plugins.grading._loadParticipants(courseId, 0, MM.plugins.participants.limitNumber,
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

					if(showAllParticipant == 0)
					MM.panels.show('center', "<a href='#course/contents/"+courseId+"'><img src='img/arrowleft.png'></a> <a href='#grading/participants/"+courseId+"/"+moduleId+"/1' > <button style='margin-left: 40%;'>"+ MM.lang.s('showall')+ "</button></a>"+html, {title: pageTitle});
					else
                    MM.panels.show('center', "<a href='#course/contents/"+courseId+"'><img src='img/arrowleft.png'></a> <a href='#grading/participants/"+courseId+"/"+moduleId+"/0'> <button style='margin-left: 40%;'> "+ MM.lang.s('submissions')+ "</button></a>"+html, {title: pageTitle});
					

					
                    // Load the first user
					if(userId != -1){
						MM.plugins.grading.viewAssign(courseId, moduleId, userId,1);
						$("#panel-center #user-"+userId).addClass("selected-row");
					}
                    else if (MM.deviceType == "tablet") {
						if(users.length > 0){
							$("#panel-center li:eq(0)").addClass("selected-row");
							MM.plugins.grading.viewAssign(courseId, moduleId, users.shift().id,1);
							$("#panel-center li:eq(0)").addClass("selected-row");
							}
						else{
							MM.panels.show("right", "<center>"+MM.lang.s('nosubmissions')+"<center>", {title: pageTitle});
						}
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
				},
				moduleId,
				showAllParticipant
                
            );
        },
		
		_loadParticipants: function(courseId, limitFrom, limitNumber, successCallback, errorCallback, moduleId, showAllParticipant) {
            var data = {
                "courseid" : courseId,
                "options[0][name]" : "limitfrom",
                "options[0][value]": limitFrom,
                "options[1][name]" : "limitnumber",
                "options[1][value]": limitNumber,
            };

            MM.moodleWSCall('moodle_user_get_users_by_courseid', data, 
				function(users) {
				    var params = {
						"courseids[0]": courseId
					};
					if(showAllParticipant == 1){
						successCallback(users);
					}
					else(
				    MM.moodleWSCall("mod_assign_get_assignments",
						params,
						function(result) {
							var course = result.courses.shift();
							var currentAssign;
							_.each(course.assignments, function(assign) {
								if (assign.cmid == moduleId) {
									currentAssign = assign;
								}
							});
						

							var params = {
								"assignmentids[0]": currentAssign.id
							};
							MM.moodleWSCall("mod_assign_get_submissions", params,
								// Success callback.
								function(result) {
									var wUsers = [];
									_.each(result.assignments[0].submissions, function(submission) {
										var text = MM.plugins.assign._getSubmissionText(submission);
										var files = MM.plugins.assign._getSubmissionFiles(submission);
										if (text != '' || files.length > 0){
											_.each(users, function(user){
												if(user.id == submission.userid)
													wUsers.push(user);
											});
										}
									});
									successCallback(wUsers);
								},
								null,
								function (error) {
									MM.popErrorMessage(error);
								}
							);
						
						}, 
						null, 
						function(m) {
							errorCallback(m);
						}
					));

				},
				null,
				function (error) {
					$("#info-" + cmid, "#panel-right").attr("src", "img/info.png");
					MM.popErrorMessage(error);
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
										
							var paramsGradingForm = {
								"courseid" : data.assign.course,
								"userids[0]" : data.user.userid
							}

							if(MM.util.wsAvailable('core_grades_update_grades')){
							/* CECI EST LE CODE POUR CHARGER LES NOTES ET COMMENTAIRES DEPUIS LE SERVEUR
							
								MM.moodleWSCall('core_grades_get_grades', paramsGradingForm, function(p) {
									// Render the grading page with grading form
									var dataGrade;
									
									_.each(p['items'], function(item) {
										if (parseInt(item.activityid) == data.assign.cmid ) {
										
											dataGrades = item;
											//delete html <>
											reg=new RegExp("<.[^<>]*>", "gi" );
											comment=item.grades[0].str_feedback.replace(reg, "" );
											dataGrades.feedback= comment.trim();
											
											//handle status
											var status = MM.db.get("grading_infos", data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid);
											if (typeof(status) !== "undefined") {
												status = status.attributes.status;
											}
											else status = "";
											
											data.status = status;
                    

										}
									});
									
									data.gradingForm = MM.tpl.render(MM.plugins.grading.templates.gradingForm.html, dataGrades);
									MM.plugins.grading._renderGradingPage(data, pageTitle);
								}, null,
								function(m) {
									// Render the grading page without grading form (error or no permissions)
									data.gradingForm = "<p>Erreur dans le chargement du formulaire d'évaluation</p>";
									MM.plugins.grading._renderGradingPage(data, pageTitle);
								});
								
								*/ 
								
								var dataGrade={};
								dataGrade.gradeMax = data.assign.grade;
									//Si les infos sont déjà défini
								var gradingInfo =MM.db.get("grading_infos", data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid);
								if(gradingInfo){
									data.status = gradingInfo.attributes.status;
									dataGrade.comment = gradingInfo.attributes.comment;
									dataGrade.grade = gradingInfo.attributes.grade;

								}
									//sinon, on les défini
								else{
									var gradingInfo = {
										id: data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid,
										courseId: data.assign.course,
										cmId: data.assign.cmid,
										userId: data.user.userid,
										status: "undefined",
										grade: null,
										comment: null,
									};

									dataGrade.comment = gradingInfo.comment;
									dataGrade.grade = gradingInfo.grade;
								}
								data.gradingForm = MM.tpl.render(MM.plugins.grading.templates.gradingForm.html, dataGrade);
								MM.plugins.grading._renderGradingPage(data, pageTitle);
								
							}	
							else{
								// Render the grading page without grading form (unavailable)
								data.gradingForm = "<p>Formulaire d'évaluation indisponible</p><br/><p>Merci de réessayer plus tard</p>";
								MM.plugins.grading._renderGradingPage(data, pageTitle);
							}
							
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

											/*
											var grading_status = {
												id: data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid,
												courseId: data.assign.course,
												cmId: data.assign.cmid,
												userId: data.user.userid,
												status: "in progress",
												grade: null,
												feedback: null,
											};
												
											MM.db.insert("grading_infos", grading_status);
											
											var path = MM.db.get("grading_infos", data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid);

											var path = MM.db.where("grading_infos", {courseId: data.assign.course} );
											*/
											
        _renderGradingPage: function(data, pageTitle) {

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
			
			//Grading status
			
			$("#grading_status .status").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();
				$('#sending_status').attr("src", "img/loadingblack.gif");
				$("#grading_status .status").removeClass( "active" );
				var newStatus = $(this).attr("id");
				var grade = MM.plugins.grading.newGrade();
				if (typeof grade === "undefined") {
					var gradingInfo =MM.db.get("grading_infos", data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid);
					if(gradingInfo){
						grade = gradingInfo.attributes.grade;
					}
				} 
				var gradingInfo = {
					id: data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid,
					courseId: data.assign.course,
					cmId: data.assign.cmid,
					userId: data.user.userid,
					status: newStatus,
					grade: grade,
					comment: MM.plugins.grading.newFeedBack()
				};
				MM.db.insert("grading_infos", gradingInfo);
				$(this).addClass("active");
				$('#sending_status').attr("src", "img/received.png");
			});
			
			
			//Update grades
			$("#update_grade_button").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();
				$('#sending_status').attr("src", "img/loadingblack.gif");
				
				var status = $("#grading_status .active").attr("id");
				var grade = MM.plugins.grading.newGrade();
				if (typeof grade === "undefined") {
					var gradingInfo =MM.db.get("grading_infos", data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid);
					if(gradingInfo){
						grade = gradingInfo.attributes.grade;
					}
				} 
				var gradingInfo = {
					id: data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid,
					courseId: data.assign.course,
					cmId: data.assign.cmid,
					userId: data.user.userid,
					status: status,
					grade: grade,
					comment: MM.plugins.grading.newFeedBack()
				};
				MM.db.insert("grading_infos", gradingInfo);
				
				$('#sending_status').attr("src", "img/received.png");
			});
			
			
			$("#send_feedbackFile_button").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();
				var filepath="fa4ac72507326161125ed6b508b62c49/assign-files/60/CV%5BGauthier%20Robin%20%5D.pdf";

				MM.fs.findFileAndGetContentsIn64(filepath, function(file){
						var params = {

							"contextlevel": "user",
							"instanceid": 3,
							"component": "user",
							"filearea": "draft",
							"itemid": 631256023,
							"filepath": "/",
							"filename": "test.pdf",
							"filecontent": file.split("base64,")[1]
						};
						
						MM.moodleWSCall('core_files_upload', params, function(file){
							alert('ok');
						},null,function(error){
							alert('pas ok');
						});
						
					}, function(e){
							alert(e);
					}
				);

				
			});
        },
		
		newGrade: function() {
			var result;
			var grade = $("#feedback_grade").val();
			grade = parseFloat(grade);
			if(!isNaN(grade))
				result = grade;
			return result;
		},
		
		newFeedBack: function() {
			var comment = $("#feedback_comment").val();
			comment = comment.trim();				
			return comment;
		},
		
        templates: {
            "gradingPage": {
                html: gradingPageTpl
            },
			"gradingForm": {
                html: gradingFormTpl
            }
        }
    };

    MM.registerPlugin(plugin);
});