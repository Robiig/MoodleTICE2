var templates = [
    "root/externallib/text!root/plugins/grading/grading_page.html",
	"root/externallib/text!root/plugins/grading/grading_form.html",
	"root/externallib/text!root/plugins/grading/participants.html",
	"root/externallib/text!root/plugins/grading/participants_row.html",
	"root/externallib/text!root/plugins/grading/admin_page.html"
];

define(templates,function (gradingPageTpl,gradingFormTpl,participantsTpl,participantsRowTpl,adminPageTpl) {
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
			["grading/module/admin/:courseid/:moduleid","grading","loadAdminPage"]
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

					//Add grading status to each users
					users.forEach(function(user) {
						var gradingInfo = MM.db.get("grading_infos", courseId+"_"+moduleId+"_"+user.id);
						if(gradingInfo){
							user.status = gradingInfo.attributes.status;
						}
                    });
					
                    var tpl = {
                        users: users,
                        deviceType: MM.deviceType,
                        courseId: courseId,
						moduleId: moduleId,
						userId: userId,
                        showMore: showMore,

                    };

					var html = MM.tpl.render(MM.plugins.grading.templates.participants.html, tpl);
						
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
							MM.plugins.grading.loadAdminPage(courseId, moduleId);
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
					
					$(".grading .status_checkbox").on(MM.clickType, function(e){
						e.preventDefault();
						e.stopPropagation();
						var userId = $(this).data("userid");
						var gradingInfo =MM.db.get("grading_infos", courseId+"_"+moduleId+"_"+userId);
						var currentLastClass = $(this).attr("class").split(" ").slice(-1).toString() ;
						var newStatus;
						if(currentLastClass == "ended_grading" || currentLastClass == "in_progress_grading"){
							$(this).removeClass(currentLastClass);
							newStatus = "undefined";
						}
						else{
							$(this).addClass("ended_grading");
							newStatus = "ended";
						}
						
						if($(this).parent().attr("class").split(" ").slice(-1).toString() == "selected-row"){
							$("#grading_status .active").removeClass('active');
							$("#grading_status #"+newStatus).addClass('active');						
						}
						else if($("#panel-center li:eq(0)").attr("class").split(" ").slice(-1).toString() == "selected-row"){
							var value = $(".info #EndedGradingNumber").html();
							value = parseInt(value);
							if(newStatus == "ended") value +=1;
							else if (currentLastClass == "ended_grading") value -= 1;
							$(".info #EndedGradingNumber").html(value);
						}
						if(gradingInfo){
							MM.plugins.grading.updateGradingInfo(courseId,moduleId,userId,newStatus,gradingInfo.attributes.grade,gradingInfo.attributes.comment, MM.plugins.grading.getFeedBackItemId(courseId,moduleId,userId));
						}
						else{
							MM.plugins.grading.updateGradingInfo(courseId,moduleId,userId,newStatus,null,null, null);
						}
						
						
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
					//On recupère que les étudaints
					var students = [];
					_.each(users, function(user) {
						if (user.roles[0].shortname == "student") {
							students.push(user);
						}
					});
					if(showAllParticipant == 1){
						successCallback(students);
					}
					
					else{
						var params = {
							"courseids[0]": courseId
						};
						//Récupérer le bon assign, puis les submissions pour avoir la listes des étudiants qui ont rendus quelque chose
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
										var studentWithSub = [];
										//Search student who sent something
										_.each(result.assignments[0].submissions, function(submission) {
											var text = MM.plugins.assign._getSubmissionText(submission);
											var files = MM.plugins.assign._getSubmissionFiles(submission);
											if (text != '' || files.length > 0){
												_.each(students, function(user){
													if(user.id == submission.userid)
														//On recupère que les etudiant avec devoir rendu ou avec brouillon après deadline
														if(submission.status == "submitted" || submission.status == "draft" && MM.util.timestamp() > currentAssign.duedate)
															studentWithSub.push(user);
												});
											}
										});
										successCallback(studentWithSub);
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
						)
					};

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
		
		loadAdminPage: function(courseId, cmId) {
		    // Loading ....
            $("#info-" + cmId, "#panel-right").attr("src", "img/loadingblack.gif");
			var tpl = {
				'date': {},
				'grading':{
					'nbGrades': 0,
					'nbComments': 0,
					'grades':{}
					},
				'participants':{
					'nbParticipants': 0,
					'nbSubmitted': 0,
					'nbDraft': 0,
				}
			};	
			
			var params = {
                "courseids[0]": courseId
            };

            MM.moodleWSCall("mod_assign_get_assignments",
                params,
                function(result) {
                    var course = result.courses.shift();
                    var currentAssign;
                    _.each(course.assignments, function(assign) {
                        if (assign.cmid == cmId) {
                            currentAssign = assign;
                        }
                    });
                    if (currentAssign) {
						var date ={}
						date.duedate = currentAssign.duedate;
						date.allowsubmissionsfromdate = currentAssign.allowsubmissionsfromdate;
						date.cutoffdate = currentAssign.cutoffdate;		
						tpl.date = date;
						
						
						var data = {
							"courseid" : courseId
						};

						MM.moodleWSCall('moodle_user_get_users_by_courseid', data, 
							function(users) {
								
								
								//On recupère que les étudaints
								var students = [];
								_.each(users, function(user) {
									if (user.roles[0].shortname == "student") {
										students.push(user);
									}
								});

								tpl.participants.nbParticipants = students.length;
								
								
								//Pour les notes
								
								var grades = {};
								grades.moy ="";
								grades.max= "";
								grades.min= "";
								
								
								//Pour le nombre de correction terminées
								
								var EndedGrading = 0;
								//Now seach on Bd Grading Infos
								var gradingInfos = MM.db.where("grading_infos", {courseId: parseInt(courseId), cmId: parseInt(cmId)} );
								if(gradingInfos.length > 0){
									_.each(gradingInfos, function(gradingInfo) {
										if (gradingInfo.attributes.grade) {
											if(tpl.grading.nbGrades == 0){
												grades.moy = gradingInfo.attributes.grade;
												grades.min = gradingInfo.attributes.grade;
												grades.max = gradingInfo.attributes.grade;
												tpl.grading.nbGrades += 1;
											}
											else{
												grades.moy += gradingInfo.attributes.grade;
												if(grades.min > gradingInfo.attributes.grade) grades.min = gradingInfo.attributes.grade;
												if(grades.max < gradingInfo.attributes.grade) grades.max = gradingInfo.attributes.grade;
												tpl.grading.nbGrades += 1;
											}
										}
										if(gradingInfo.attributes.comment && gradingInfo.attributes.comment != ""){
											tpl.grading.nbComments +=1;
										}
										if(gradingInfo.attributes.status && gradingInfo.attributes.status == "ended")
											EndedGrading += 1;
									});
									
									if(tpl.grading.nbGrades > 0)grades.moy /= tpl.grading.nbGrades;
								}
								tpl.grading.grades = grades;
								tpl.grading.nbEndedGrading = EndedGrading;
								
								//on recupère les rendus
								var params = {
									"assignmentids[0]": currentAssign.id
								};	
					
								MM.moodleWSCall("mod_assign_get_submissions",
									params,
									// Success callback.
									function(result) {
										// Stops loading...
										$("#info-" + currentAssign.cmid, "#panel-right").attr("src", "img/info.png");

										var sectionName = "";
										if (MM.plugins.assign.sectionsCache[currentAssign.cmid]) {
											sectionName = MM.plugins.assign.sectionsCache[currentAssign.cmid];
										}

										var pageTitle = '<div id="back-arrow-title" class="media">\
												<div class="img app-ico">\
													<img src="img/mod/assign.png" alt="img">\
												</div>\
												<div class="bd">\
													<h2>' + MM.util.formatText(currentAssign.name) + '</h2>\
												</div>\
											</div>';
											
										tpl.participants.nbSubmitted = 0;
										tpl.participants.nbDraft = 0;
										var assign = result.assignments.shift();
										
										//on parcourt les rendus
										_.each(assign.submissions, function(submission) {
											
											//si le rendu est définitif
											if (submission.status == "submitted") {
												//on verifie que c'est le rendu d'un étudiant
												_.each(students, function(student) {
													if (submission.userid == student.id) {
														tpl.participants.nbSubmitted += 1;
													}
												});
											}
											//si c'est un brouillon
											else if(submission.status == "draft") {
											//on verifie que c'est le rendu d'un étudiant
												_.each(students, function(student) {
													if (submission.userid == student.id) {
														tpl.participants.nbDraft += 1;
													}
												});
											}
										});
										
										
										//then render page
										
										MM.plugins.grading._renderAdminPage(tpl, pageTitle);
																						
									},
									null,
									function (error) {
										$("#info-" + cmId, "#panel-right").attr("src", "img/info.png");
										MM.popErrorMessage(error);
									}
								);
							},
							null,
							function (error) {
								$("#info-" + cmId, "#panel-right").attr("src", "img/info.png");
								MM.popErrorMessage(error);
							}
						);
					}
				},
				null,
				function (error) {
					$("#info-" + cmId, "#panel-right").attr("src", "img/info.png");
					MM.popErrorMessage(error);
				}
			);
		},
		
		
        _renderAdminPage: function(tpl, pageTitle) {		
			var html = MM.tpl.render(MM.plugins.grading.templates.adminPage.html, tpl);
			MM.panels.show('right', html, {title: pageTitle});
			
			//Jquery
			$("#sending_button").on(MM.clickType, function(e)  {
				e.preventDefault();
				e.stopPropagation();
				if(MM.deviceConnected()){
					var sendWay = $("input[type=radio][name=send]:checked").val();
					if(sendWay== "ended"){
						MM.popConfirm("Confirmez-vous la syncronisation de toutes les corrections terminées ?<br/>(Les étudiants concernés pourrons consulter leurs corrections)",null ,null );
					}
					else if(sendWay== "all"){
						MM.popConfirm("Confirmez vous la syncronisation de toutes les corrections ? <br/>(Les étudiants concernés pourrons consulter leurs corrections)",null ,null );
					}
				}
				else{
					MM.popErrorMessage(MM.lang.s('nosyncdisconnected'));
				}
			});
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
										itemId: null
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
				
				$("#grading_status .status").removeClass( "active" );
				
				$(".users-index-list .selected-row .status_checkbox").removeClass("undefined_grading");
				$(".users-index-list .selected-row .status_checkbox").removeClass("in_progress_grading");
				$(".users-index-list .selected-row .status_checkbox").removeClass("ended_grading");
				var newStatus = $(this).attr("id");		
				var grade = MM.plugins.grading.newGrade(data.assign.course,data.assign.cmid,data.user.userid);
				var comment = MM.plugins.grading.newFeedBack();
				MM.plugins.grading.updateGradingInfo(data.assign.course,data.assign.cmid,data.user.userid,newStatus,grade,comment, MM.plugins.grading.getFeedBackItemId(data.assign.course,data.assign.cmid,data.user.userid));
				
				$(this).addClass("active");
				
				
				$(".users-index-list .selected-row .status_checkbox").addClass(newStatus+"_grading");
				
			});
			
			
			//Update grades
			$("#update_grade_button").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();
				$('#sending_status').attr("src", "img/loadingblack.gif");
				var status = $("#grading_status .active").attr("id");
				var grade = MM.plugins.grading.newGrade(data.assign.course,data.assign.cmid,data.user.userid);
				var comment = MM.plugins.grading.newFeedBack();
				
				MM.plugins.grading.updateGradingInfo(data.assign.course,data.assign.cmid,data.user.userid,status,grade,comment, MM.plugins.grading.getFeedBackItemId(data.assign.course,data.assign.cmid,data.user.userid));
				
				$('#sending_status').attr("src", "img/received.png");
				

			});
			
			
			//Automatic update
			$( "#grading #feedback_grade , #grading #feedback_comment" ).focusout(MM.clickType, function(e)  {
			    e.preventDefault();
                e.stopPropagation();
				var status = $("#grading_status .active").attr("id");
				var grade = MM.plugins.grading.newGrade(data.assign.course,data.assign.cmid,data.user.userid);
				var comment = MM.plugins.grading.newFeedBack();
				MM.plugins.grading.updateGradingInfo(data.assign.course,data.assign.cmid,data.user.userid, status,grade,comment, MM.plugins.grading.getFeedBackItemId(data.assign.course,data.assign.cmid,data.user.userid));
				
			});
			
			
			$("#sending_button").on(MM.clickType, function(e) {
                e.preventDefault();
                e.stopPropagation();
				
				if(MM.deviceConnected()){
	
					MM.popConfirm("Confirmez-vous la syncronisation ?<br/>(L'étudiant concerné pourra consulter la correction)",function(){ 
					
						var params = {

							"contextlevel": "user",
							"instanceid": MM.config.current_site.userid,
							"component": "user",
							"filearea": "draft",
							"itemid": -1,

							
						};

						
						
						MM.moodleWSCall('core_files_upload', params, function(file){			
							var itemId = file.itemid;						
						},null,function(error){
						});
						
								//find localFiles
					/*	var currentSub;
						_.each(data.submissions, function(sub){
							if(sub.userid == data.user.userid){
								currentSub = sub;
							}					
						});
						var localFiles = MM.plugins.grading._getLocalSubmissionFiles(currentSub);
						var itemId;
						var userGradingInfos = MM.db.get("grading_infos", data.assign.course+"_"+data.assign.cmid+"_"+data.user.userid);
						if(userGradingInfos){
							itemId = userGradingInfos.attributes.itemId;
						}
						if (localFiles && localFiles.length > 0){
							MM.plugins.grading.sendLocalSubmissionsFilesinDraft(data.assign,localFiles,data.user.userid, itemId);
							MM.plugins.grading.sendFeedBack(data.assign, data.user.userid);
						}
						else
							MM.plugins.grading.sendFeedBack(data.assign, data.user.userid);
						*/
						
					},null );
					
				} else{
					MM.popErrorMessage(MM.lang.s('nosyncdisconnected'));
				}
			});
        },
		
		/*
		sendFeedBack: function(assign, userId){
			var userId = 0 || userId;
			
			//Récuperer les données utilisateurs concernées
			var gradingInfos = [];
			if (userId != 0 ){
				var userGradingInfos = MM.db.get("grading_infos", assign.course+"_"+assign.cmid+"_"+userId);
				if(userGradingInfos){
					gradingInfos[0] = userGradingInfos;
				}
			}
			else{
				gradingInfos = MM.db.where("grading_infos", {courseId: parseInt(assign.course), cmId: parseInt(assign.cmid)} );
			}
			
			var grades = [];
			var params = {
				"assignmentids[0]": assign.id
			};
			if(gradingInfos.length > 0){
				//Parcourt des données (utilisateurs par utilisateurs)
				
				MM.moodleWSCall("mod_assign_get_submissions", params,
					
					function(result) {
						var submissions = result.assignments[0].submissions;
						var elems = 0;
						_.each(gradingInfos, function(gradingInfo) {
						
							var currentSub;
							//recuperer submission de l'utilisateur pour le devoir
							_.each(submissions, function(sub){
								if(sub.userid == gradingInfo.attributes.userId){
									currentSub = sub;
								}					
							});
							
							if(currentSub){
								var itemId = null;
								if(gradingInfo.itemId != null){
									itemId = gradingInfo.itemId;
								}
							}
							
							
							
							//Ajoute tous les éléments de notation :
							grades[elems] = {
								userid: currentSub.userid,
								grade: gradingInfo.attributes.grade,
								attemptnumber: -1,
								addattempt: 0,
								workflowstate: "",
								plugindata: {
									assignfeedbackcomments_editor: {
										text: gradingInfo.attributes.comment,
										format: 4,
									},
									files_filemanager: itemId
								}
								
							}
							elems +=1;
						});
					
						if(grades != null && grades.length > 0) {
							var params = {
								assignmentid: assignId,
								applytoall: 0,
								grades : grades
							};
							MM.moodleWSCall('mod_assign_save_grades', params, function(e){
									alert('ok');
								},null,function(error){
									alert('pas ok');
								});
										
						}
					
					
					},
					null,
					function (error) {
						MM.popErrorMessage(error);
					}
				);

	
			}

		},
		
		sendLocalSubmissionsFilesinDraft: function(assign,localFiles,userId, itemId){
			var itemId = -1 || itemId;

			
				//envoyer chaque localFile
				_.each(localFiles, function(currentFile){
					var filePath = currentFile.localpath.replace("filesystem:file:///persistent/", "");
					MM.fs.findFileAndGetContentsIn64(filePath, function(file){
					
						var beginRange = currentFile.filepath.lastIndexOf('/')+1; // Plus 1 car on ne veut pas le '/'. 
						var endRange = currentFile.filepath.length; 
						var fileName = currentFile.filepath.substring(beginRange, endRange); 
						var filePath = currentFile.filepath.substring(0, beginRange); 
						
						
						var params = {

							"contextlevel": "user",
							"instanceid": MM.config.current_site.userid,
							"component": "user",
							"filearea": "draft",
							"itemid": itemId,
							"filepath": filePath,
							"filename": fileName,
							"filecontent": file.split("base64,")[1]
							
						};

						
						
						MM.moodleWSCall('core_files_upload', params, function(file){			
							var itemId = file.itemid;
							var gradingInfo = MM.db.get("grading_infos", assign.course+"_"+assign.cmid+"_"+userId);
							if(gradingInfo){
								MM.plugins.grading.updateGradingInfo(gradingInfo.attributes.courseId,gradingInfo.attributes.moduleId,gradingInfo.attributes.userId,gradingInfo.attributes.status,gradingInfo.attributes.grade,gradingInfo.attributes.comment,file.itemid);
							}	
							
						},null,function(error){
							
						});
						
						
					}, function(e){
						
					});
				
				});
			
			
		},
		*/
		
		_getLocalSubmissionFiles: function(submission) {
            var files = [];
            if (submission.plugins) {
                submission.plugins.forEach(function(plugin) {
                    if (plugin.type == 'file' && plugin.fileareas && plugin.fileareas[0] && plugin.fileareas[0].files) {
                        files = plugin.fileareas[0].files;
                    }
                });
            }
            // Find local path of files.
            if (files.length > 0) {
                for (var el in files) {
                    var file = files[el];
					var localFiles = [];
                    var uniqueId = MM.config.current_site.id + "-" + hex_md5(file.fileurl);
                    var path = MM.db.get("assign_files", uniqueId);
                    if (path) {
					localFiles[el] = file;
                        localFiles[el].localpath = path.get("localpath");
                    }
                }
            }
            return localFiles;
        },
		
		
		updateGradingInfo: function(courseId,moduleId,userId,status,grade,comment,itemId){
			var gradingInfo = {
				id: courseId+"_"+moduleId+"_"+userId,
				courseId: parseInt(courseId),
				cmId: parseInt(moduleId),
				userId: parseInt(userId),
				status: status,
				grade: grade,
				comment: comment,
				itemId: itemId,
				
			};
			MM.db.insert("grading_infos", gradingInfo);
		},
		
		newGrade: function(courseId,cmId,userId) {
			var result;
			var grade = $("#feedback_grade").val();
			if(grade.trim() == ""){
				result = null;
			}
			else{
				grade = parseFloat(grade);
				if(!isNaN(grade)){
					result = grade;
				}
			
				else{
					var gradingInfo =MM.db.get("grading_infos", courseId+"_"+cmId+"_"+userId);
					if(gradingInfo){
						result = gradingInfo.attributes.grade;
					}			
				}
			}
			return result;
		},
		
		
		newFeedBack: function() {
			var comment = $("#feedback_comment").val();
			comment = comment.trim();				
			return comment;
		},
		
		getFeedBackItemId: function(courseId, cmId, userId){
			var itemId;
			var gradingInfo = MM.db.get("grading_infos", courseId+"_"+cmId+"_"+userId);
			
				if(gradingInfo){
					itemId = gradingInfo.attributes.itemId;
				}
			return itemId;
		},
		
        templates: {
            "gradingPage": {
                html: gradingPageTpl
            },
			"gradingForm": {
                html: gradingFormTpl
            },
			"participants": {
                html: participantsTpl
            },
			"participantsRow": {
                html: participantsRowTpl
            },
			"adminPage": {
                html: adminPageTpl
            }
        }
    };

    MM.registerPlugin(plugin);
});