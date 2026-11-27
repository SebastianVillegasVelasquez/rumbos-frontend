# Staging checklist: the closing journey with a test student

For the screens. How to set the mode, force a result, read the API and reset a student is in the
backend's `docs/TESTING-closing-flow.md`; read its first section before starting.

**A pass by a test student is a real pass:** it can complete the course, issue certificates,
write the grade and mark SCORM content complete, and nothing undoes it. Use a dedicated test
course that gates nothing, a test user with the `student` role (a teacher's attempts are
previews), and a private window per student.

## Before

- [ ] Plugin, backend and frontend deployed. Note their versions.
- [ ] `GET /trainer/closing` shows `scorm_gate.reason: not_checked` (observe mode).
- [ ] Test course: check-in with 1 attempt, final with 3, exemption on; a closing flow with a
      content step, an activity and the final step; at least 2 tracked activities on the same map.
- [ ] As the editor, write all three journey texts and both congratulations, each with a word you
      will recognise, using every placeholder allowed. Save, reload, check they are still there.
- [ ] Try `{score}` in the route text and save: a Spanish error on that field. Remove it.
- [ ] Publish the map.
- [ ] As the editor, in "Vista previa" with editing on, run "Simular recorrido" once passing and
      once failing.

## Student A: fails the check-in

- [ ] Before the check-in: no "Continuar al cierre", even if you complete an activity.
- [ ] Submit the check-in empty: your route text appears on the map. No closing card.
- [ ] Complete all activities but one: still no closing card, after a reload too.
- [ ] Complete the last one: "Continuar al cierre" appears without a reload (reload if not, and
      note it). The flow does not open by itself.
- [ ] Enter the closing and reload halfway: it resumes on the pending step.
- [ ] **The final step offers "Empezar la evaluación"**, not "todavía no tiene preguntas".
- [ ] Fail it (submit empty): your failure text with 1, 3, 2 and the pass mark; your button label.
- [ ] Reload: the card is offered again. Fail a second time: 2, 3, 1.
- [ ] Fail a third time: your exhausted text. No promise of a restart. No fourth attempt after a
      reload.

## Student B: passes the check-in

- [ ] Your check-in congratulations, with the score and the pass mark filled in.
- [ ] Close the tab on that screen, or right after pressing its button before finishing a step:
      on the next visit the congratulations come back. No "Continuar al cierre" card.
- [ ] Press its button: the closing opens **without** the final.
- [ ] Reload halfway: it resumes. Finish: the map, with no further prompt.
- [ ] On the Moodle side, check what the pass marked complete.

## Student C: passes the final

- [ ] Fail the check-in, complete the activities, pass the final.
- [ ] Your final congratulations show the **final's** score and pass mark. To check it is not the
      check-in's, change the pass mark and publish after the check-in and before the final.
- [ ] Reload in a new private window: the same values, then no prompt on later visits.

## Also

- [ ] A closing that holds only the final, with a student who passes the check-in:
      congratulations, then the map.
- [ ] One pass in Safari (iPhone or Mac): the browser tests' WebKit is not Safari.
- [ ] With the mode `off`: no journey screens or cards appear.
- [ ] Restore the pass mark, publish, and set the mode back.

For each failure note the student, the screen, the `GET /trainer/closing` body (never the token)
and the browser. `enforce` cannot be tested on a deployed environment yet: there is no completion
provider.
